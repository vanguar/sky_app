/** Owns GPU resources, including results delivered after the viewer has been closed. */
export class ResourceScope {
  private resources = new Set<{ dispose(): void }>();
  private closed = false;

  own(resource: { dispose(): void }): boolean {
    if (this.closed) {
      resource.dispose();
      return false;
    }
    this.resources.add(resource);
    return true;
  }

  release(resource: { dispose(): void } | null): void {
    if (resource && this.resources.delete(resource)) resource.dispose();
  }

  dispose(): void {
    this.closed = true;
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}
