/** DOM/querySelector ergonomics for checkJs. */
interface Element {
  readonly dataset: DOMStringMap;
  focus(options?: FocusOptions): void;
  onclick: OnClickEventHandler | null;
}

interface Event {
  readonly key: string;
  readonly dataTransfer: DataTransfer | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
