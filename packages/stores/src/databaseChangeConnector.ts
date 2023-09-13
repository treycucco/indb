import type { Database, DatabaseEvent } from '@indb/database';

/**
 * This class handles setting up and tearing down database listeners so that the composing object
 * can act as a source for `useSyncExternalStore`.
 */
export default class DatabaseChangeConnector<Tables extends object> {
  private readonly database: Database<Tables>;
  private readonly eventTarget = new EventTarget();
  private deregisterDatabaseListener: (() => void) | null = null;
  private setupPromise: Promise<void> | null = null;

  constructor(database: Database<Tables>) {
    this.database = database;
  }

  /**
   * Setup the exteralStore instance.
   *
   * It registers a listener with the database for changes to the store, and calls whatever setup
   * method is passed from the owner.
   *
   * This method is safe to call repeatedly, but will only run the setup once between calls to
   * `teardown`.
   */
  async setup(
    setup: () => Promise<void>,
    listener: (event: DatabaseEvent) => void,
  ) {
    if (this.setupPromise !== null) {
      return this.setupPromise;
    }

    this.deregisterDatabaseListener = this.database.addEventListener(
      'changed',
      listener,
    );
    this.setupPromise = new Promise((resolve, reject) => {
      setup()
        .then(() => resolve())
        .catch(() => reject());
    });

    return this.setupPromise;
  }

  /**
   * Deregisterm the database listener and clear the setup promise so setup can be called again.
   */
  teardown() {
    this.deregisterDatabaseListener?.();
    this.setupPromise = null;
  }

  /**
   * Subscribe a callback to the changed event.
   */
  subscribe(callback: () => void) {
    const handler = () => callback();
    this.eventTarget.addEventListener('changed', handler);
    return () => this.eventTarget.removeEventListener('changed', handler);
  }

  /**
   * Dispatch a changed event.
   */
  dispatchChanged() {
    this.eventTarget.dispatchEvent(new CustomEvent('changed'));
  }
}
