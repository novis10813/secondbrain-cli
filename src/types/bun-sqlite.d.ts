declare module 'bun:sqlite' {
  export class Database {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }

  export interface Statement {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
  }
}
