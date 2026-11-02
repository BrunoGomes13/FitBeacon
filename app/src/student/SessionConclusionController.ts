export class SessionConclusionController {
  private readonly completedSessionIds = new Set<string>();
  private readonly activeSessionIds = new Set<string>();
  private readonly navigateHome: () => void;

  constructor(navigateHome: () => void) {
    this.navigateHome = navigateHome;
  }

  begin(clientSessionId: string): void {
    this.activeSessionIds.add(clientSessionId);
  }

  conclude(clientSessionId: string, finalize: () => void): boolean {
    if (
      !this.activeSessionIds.has(clientSessionId) ||
      this.completedSessionIds.has(clientSessionId)
    ) {
      return false;
    }

    this.activeSessionIds.delete(clientSessionId);
    this.completedSessionIds.add(clientSessionId);

    try {
      finalize();
    } finally {
      this.navigateHome();
    }

    return true;
  }
}
