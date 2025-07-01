export interface BaseComponent {
    element: HTMLElement;
    show(): void;
    hide(): void;
    render(): Promise<void>;
}