import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Logger } from "../logger.js";

const snapshotSchema = z.object({
  version: z.literal(1),
  documents: z.array(
    z.object({ id: z.string(), title: z.string(), text: z.string(), vector: z.array(z.number()) }),
  ),
});

export type Snapshot = z.infer<typeof snapshotSchema>;

/** Returns null when no snapshot exists yet; throws when the file is present but invalid. */
export async function loadSnapshot(path: string): Promise<Snapshot | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return snapshotSchema.parse(JSON.parse(raw));
}

/** Debounced, atomic (temp file + rename) snapshot writer. */
export class SnapshotWriter {
  private timer: NodeJS.Timeout | undefined;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly source: () => Snapshot,
    private readonly logger: Logger,
    private readonly delayMs = 1000,
  ) {}

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
    this.timer.unref();
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const data = JSON.stringify(this.source());
    this.chain = this.chain
      .then(async () => {
        await mkdir(dirname(this.path), { recursive: true });
        const tmp = `${this.path}.tmp`;
        await writeFile(tmp, data);
        await rename(tmp, this.path);
      })
      .catch((err: unknown) => this.logger.error({ err }, "snapshot write failed"));
    return this.chain;
  }
}
