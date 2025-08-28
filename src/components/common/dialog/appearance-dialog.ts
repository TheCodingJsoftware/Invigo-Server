import {DialogComponent} from "@components/common/dialog/dialog-component";
import {invertImages} from "@utils/theme";

export class AppearanceDialog extends DialogComponent {
    constructor() {
        super({
            id: "appearance-dialog",
            title: "Appearance",
            bodyContent: `<div>
                <div id="theme-buttons">
                    <div class="padding">
                        <div class="row wrap padding border round">
                            <button class="circle small red" data-color="#f44336" id="theme-button"></button>
                            <button class="circle small pink" data-color="#e91e63" id="theme-button"></button>
                            <button class="circle small purple" data-color="#9c27b0" id="theme-button"></button>
                            <button class="circle small deep-purple" data-color="#673ab7" id="theme-button"></button>
                            <button class="circle small indigo" data-color="#3f51b5" id="theme-button"></button>
                            <button class="circle small blue" data-color="#2196f3" id="theme-button"></button>
                            <button class="circle small light-blue" data-color="#03a9f4" id="theme-button"></button>
                            <button class="circle small cyan" data-color="#00bcd4" id="theme-button"></button>
                            <button class="circle small teal" data-color="#009688" id="theme-button"></button>
                            <button class="circle small green" data-color="#4caf50" id="theme-button"></button>
                            <button class="circle small light-green" data-color="#8bc34a" id="theme-button"></button>
                            <button class="circle small lime" data-color="#cddc39" id="theme-button"></button>
                            <button class="circle small yellow" data-color="#ffeb3b" id="theme-button"></button>
                            <button class="circle small amber" data-color="#ffc107" id="theme-button"></button>
                            <button class="circle small orange" data-color="#ff9800" id="theme-button"></button>
                            <button class="circle small deep-orange" data-color="#ff5722" id="theme-button"></button>
                            <button class="circle small">
                                <i>palette</i>
                                <input type="color" id="select-color">
                            </button>
                        </div>
                    </div>
                </div>
                <div class="row wrap center-align">
                    <label class="radio vertical padding border round">
                        <img class="ignore-invert" src="https://www.gstatic.com/pantheon/images/user_preferences/light-illustration.svg" width="200px"/>
                        <input type="radio" name="radio-mode" id="light-theme" />
                        <span>Light</span>
                    </label>
                    <label class="radio vertical padding border round">
                        <img class="ignore-invert" src="https://www.gstatic.com/pantheon/images/user_preferences/dark-illustration.svg" width="200px"/>
                        <input type="radio" name="radio-mode" id="dark-theme" />
                        <span>Dark</span>
                    </label>
                    <label class="radio vertical padding border round">
                        <img class="ignore-invert" src="https://www.gstatic.com/pantheon/images/user_preferences/auto-illustration.svg" width="200px"/>
                        <input type="radio" name="radio-mode" id="same-as-device" />
                        <span>Automatic</span>
                    </label>
            </div>
            </div>`,
        });
        this.init();
    }

    init() {
        const lightModeButton = this.element.querySelector("#light-theme") as HTMLInputElement;
        lightModeButton.addEventListener("click", () => {
            ui("mode", "light");
            localStorage.setItem("mode", "light")
            invertImages();
        });

        const darkModeButton = this.element.querySelector("#dark-theme") as HTMLInputElement;
        darkModeButton.addEventListener("click", () => {
            ui("mode", "dark");
            localStorage.setItem("mode", "dark");
            invertImages();
        });

        const sameAsDeviceButton = this.element.querySelector("#same-as-device") as HTMLInputElement;
        sameAsDeviceButton.addEventListener("click", () => {
            ui("mode", "auto");
            localStorage.setItem("mode", "auto");
            invertImages();
        });

        const savedMode = localStorage.getItem("mode") || "auto";
        if (savedMode === "auto") {
            sameAsDeviceButton.checked = true;
        } else if (savedMode === "dark") {
            darkModeButton.checked = true;
        } else {
            lightModeButton.checked = true;
        }

        const themeButtons = this.element.querySelectorAll("#theme-button") as NodeListOf<HTMLButtonElement>;
        themeButtons.forEach(button => {
            button.addEventListener("click", () => {
                const color = button.dataset.color as string;
                localStorage.setItem("theme", color);
                ui("theme", color);
            });
        });

        const selectColorInput = this.element.querySelector("#select-color") as HTMLInputElement;
        selectColorInput.addEventListener("change", () => {
            const color = selectColorInput.value;
            localStorage.setItem("theme", color);
            ui("theme", color);
        });
    }

}
