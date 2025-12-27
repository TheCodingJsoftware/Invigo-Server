export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 200) {
    let timer: number;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), delay);
    };
}