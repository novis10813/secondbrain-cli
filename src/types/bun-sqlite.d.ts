declare module 'bun:sqlite' {
  export class Database {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }

  export interface Statement {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
  }
}
