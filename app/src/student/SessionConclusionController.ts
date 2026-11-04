export class SessionConclusionController {
  private readonly completedSessionIds = new Set<string>();
  private readonly activeSessionIds = new Set<string>();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly navigateHome: () => void;

  constructor(navigateHome: () => void) {
    this.navigateHome = navigateHome;
  }

  begin(clientSessionId: string): void {
    this.activeSessionIds.add(clientSessionId);
  }

  conclude(clientSessionId: string, finalize: () => void | Promise<void>): boolean | Promise<boolean> {
    const pending = this.pending.get(clientSessionId);
    if (pending) return pending;
    if (!this.activeSessionIds.has(clientSessionId) || this.completedSessionIds.has(clientSessionId)) {
      return false;
    }

    const result = finalize();

    if (!result || typeof result.then !== 'function') {
      this.complete(clientSessionId);
      return true;
    }

    const operation = Promise.resolve(result).then(
      () => {
        this.complete(clientSessionId);
        return true;
      },
      (error: unknown) => {
        this.pending.delete(clientSessionId);
        throw error;
      },
    );
    this.pending.set(clientSessionId, operation);
    return operation;
  }

  private complete(clientSessionId: string): void {
    this.pending.delete(clientSessionId);
    this.activeSessionIds.delete(clientSessionId);
    this.completedSessionIds.add(clientSessionId);
    this.navigateHome();
  }

  isActive(clientSessionId: string): boolean {
    return this.activeSessionIds.has(clientSessionId);
  }

  isCompleted(clientSessionId: string): boolean {
    return this.completedSessionIds.has(clientSessionId);
  }

}
