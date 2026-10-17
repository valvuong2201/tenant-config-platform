import fs from "node:fs";
import path from "node:path";
import { MemoryStore, type StoreState } from "./memoryStore";

/** Local-dev store: the whole state lives in one JSON file, written atomically after each change. */
export class JsonFileStore extends MemoryStore {
  constructor(private readonly file: string) {
    super();
    if (fs.existsSync(file)) {
      this.state = JSON.parse(fs.readFileSync(file, "utf8")) as StoreState;
    }
  }

  protected persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
