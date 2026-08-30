import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { DockContainer } from './dockContainer.js';

export default class MacUbuntuDockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Create main dock container actor
        this._dockContainer = new DockContainer(this._settings);

        // Add to GNOME Shell Chrome so it overlays correctly on top of desktop
        Main.layoutManager.addChrome(this._dockContainer, {
            affectsStrut: true,
            trackHover: true,
            affectsInputRegion: true,
        });

        // Ensure dock updates position on screen resolution/workarea changes
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            if (this._dockContainer) {
                this._dockContainer.updatePosition();
            }
        });
    }

    disable() {
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }

        if (this._dockContainer) {
            Main.layoutManager.removeChrome(this._dockContainer);
            this._dockContainer.destroy();
            this._dockContainer = null;
        }

        this._settings = null;
    }
}
