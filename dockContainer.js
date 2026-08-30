import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { DockItem, DockItemType } from './dockItem.js';
import { DockManager } from './dockManager.js';

export const DockContainer = GObject.registerClass({
    GTypeName: 'MacUbuntuDockContainer',
}, class DockContainer extends St.Widget {
    _init(settings) {
        super._init({
            name: 'MacUbuntuDockContainer',
            reactive: true,
            track_hover: true,
        });

        this.settings = settings;
        this.dockManager = new DockManager();
        this.items = [];
        this._isHiding = false;
        this._autohideTimeoutId = 0;

        // Outer box for alignment
        this._outerBox = new St.BoxLayout({
            style_class: 'dock-outer-box',
            reactive: true,
        });
        this.add_child(this._outerBox);

        // Inner styled container
        this._innerContainer = new St.BoxLayout({
            style_class: 'dock-container dock-preset-macos',
            reactive: true,
            track_hover: true,
        });
        this._outerBox.add_child(this._innerContainer);

        // Connect dockManager updates
        this._dockAppsChangedId = this.dockManager.connect('dock-apps-changed', () => {
            this.rebuildDock();
        });
        this._appStateChangedId = this.dockManager.connect('app-state-changed', () => {
            this.updateItemStates();
        });

        // Setup Settings signals
        this._settingSignals = [];
        const updateKeys = [
            'dock-preset', 'dock-position', 'icon-size',
            'show-trash', 'show-launcher', 'launcher-position',
            'indicator-style', 'dock-translucency', 'dock-corner-radius'
        ];
        for (const key of updateKeys) {
            this._settingSignals.push(
                this.settings.connect(`changed::${key}`, () => {
                    this.applySettings();
                    this.rebuildDock();
                })
            );
        }

        // Auto-hide settings listener
        this._settingSignals.push(
            this.settings.connect('changed::autohide', () => {
                this.setupAutoHide();
            })
        );

        // Mouse Motion for macOS Magnification
        this.connect('motion-event', (actor, event) => {
            if (this.settings.get_boolean('enable-magnification')) {
                this._onMotionEvent(event);
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.connect('leave-event', () => {
            this._resetIconScales();
            return Clutter.EVENT_PROPAGATE;
        });

        // Hover for auto-hide reveal
        this.connect('notify::hover', () => {
            if (this.hover && this._isHiding) {
                this.showDock();
            }
        });

        this.applySettings();
        this.rebuildDock();
        this.setupAutoHide();
    }

    applySettings() {
        const preset = this.settings.get_string('dock-preset') || 'macos';
        const position = this.settings.get_string('dock-position') || 'bottom';
        const isVertical = position === 'left' || position === 'right';

        this._outerBox.vertical = isVertical;
        this._innerContainer.vertical = isVertical;

        let presetClass = 'dock-preset-macos';
        if (preset === 'ubuntu') {
            presetClass = 'dock-preset-ubuntu';
        } else if (preset === 'classic') {
            presetClass = 'dock-preset-classic';
        }

        this._innerContainer.style_class = `dock-container ${presetClass}`;

        const translucency = this.settings.get_double('dock-translucency');
        const radius = this.settings.get_int('dock-corner-radius');

        let bgRgba = 'rgba(28, 28, 38, ' + translucency + ')';
        if (preset === 'ubuntu') {
            bgRgba = 'rgba(18, 18, 18, ' + translucency + ')';
        }

        this._innerContainer.set_style(
            `background-color: ${bgRgba}; border-radius: ${radius}px;`
        );

        this.updatePosition();
    }

    updatePosition() {
        const position = this.settings.get_string('dock-position') || 'bottom';
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor) return;

        this.ensure_style();
        const [minWidth, naturalWidth] = this.get_preferred_width(-1);
        const [minHeight, naturalHeight] = this.get_preferred_height(-1);

        let x = monitor.x + (monitor.width - naturalWidth) / 2;
        let y = monitor.y + monitor.height - naturalHeight;

        if (position === 'top') {
            y = monitor.y + Main.panel.height;
            x = monitor.x + (monitor.width - naturalWidth) / 2;
        } else if (position === 'left') {
            x = monitor.x;
            y = monitor.y + (monitor.height - naturalHeight) / 2;
        } else if (position === 'right') {
            x = monitor.x + monitor.width - naturalWidth;
            y = monitor.y + (monitor.height - naturalHeight) / 2;
        }

        this.set_position(Math.round(x), Math.round(y));
    }

    rebuildDock() {
        this._innerContainer.destroy_all_children();
        this.items = [];

        const iconSize = this.settings.get_int('icon-size') || 48;
        const position = this.settings.get_string('dock-position') || 'bottom';
        const isVertical = position === 'left' || position === 'right';
        const launcherPos = this.settings.get_string('launcher-position') || 'start';

        // 1. Launcher button at start
        if (this.settings.get_boolean('show-launcher') && launcherPos === 'start') {
            const launcher = new DockItem(DockItemType.LAUNCHER, null, this.settings, iconSize);
            this._innerContainer.add_child(launcher);
            this.items.push(launcher);
        }

        const { favorites, runningOnly } = this.dockManager.getDockApps();

        // 2. Favorite Apps
        for (const itemData of favorites) {
            const item = new DockItem(DockItemType.APP, itemData.app, this.settings, iconSize);
            this._innerContainer.add_child(item);
            this.items.push(item);
        }

        // 3. Separator between favorites and running unpinned apps
        if (runningOnly.length > 0) {
            const sep = new St.Widget({
                style_class: isVertical ? 'dock-separator-vertical' : 'dock-separator',
            });
            this._innerContainer.add_child(sep);
        }

        // 4. Running unpinned apps
        for (const itemData of runningOnly) {
            const item = new DockItem(DockItemType.APP, itemData.app, this.settings, iconSize);
            this._innerContainer.add_child(item);
            this.items.push(item);
        }

        // 5. Separator before trash/launcher at end
        const showTrash = this.settings.get_boolean('show-trash');
        const showLauncherAtEnd = this.settings.get_boolean('show-launcher') && launcherPos === 'end';

        if (showTrash || showLauncherAtEnd) {
            const sep = new St.Widget({
                style_class: isVertical ? 'dock-separator-vertical' : 'dock-separator',
            });
            this._innerContainer.add_child(sep);
        }

        // 6. Launcher button at end
        if (showLauncherAtEnd) {
            const launcher = new DockItem(DockItemType.LAUNCHER, null, this.settings, iconSize);
            this._innerContainer.add_child(launcher);
            this.items.push(launcher);
        }

        // 7. Trash icon
        if (showTrash) {
            const trash = new DockItem(DockItemType.TRASH, null, this.settings, iconSize);
            this._innerContainer.add_child(trash);
            this.items.push(trash);
        }

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.updatePosition();
            return GLib.SOURCE_REMOVE;
        });
    }

    updateItemStates() {
        for (const item of this.items) {
            if (item && typeof item.updateState === 'function') {
                item.updateState();
            }
        }
    }

    _onMotionEvent(event) {
        const [mouseX, mouseY] = event.get_coords();
        const maxScale = this.settings.get_double('magnification-scale') || 1.4;
        const position = this.settings.get_string('dock-position') || 'bottom';
        const isVertical = position === 'left' || position === 'right';

        for (const item of this.items) {
            if (!item || !item.get_transformed_position) continue;

            const [itemX, itemY] = item.get_transformed_position();
            const [itemW, itemH] = item.get_transformed_size();

            const itemCenter = isVertical ? (itemY + itemH / 2) : (itemX + itemW / 2);
            const mousePos = isVertical ? mouseY : mouseX;

            const distance = Math.abs(mousePos - itemCenter);
            const maxDistance = itemW * 2.5;

            if (distance < maxDistance) {
                // Cosine magnification scale profile
                const factor = Math.cos((distance / maxDistance) * (Math.PI / 2));
                const scale = 1.0 + (maxScale - 1.0) * factor;
                item.setScale(scale);
            } else {
                item.setScale(1.0);
            }
        }
    }

    _resetIconScales() {
        for (const item of this.items) {
            if (item && typeof item.setScale === 'function') {
                item.setScale(1.0);
            }
        }
    }

    setupAutoHide() {
        if (this._windowTrackerId) {
            global.window_manager.disconnect(this._windowTrackerId);
            this._windowTrackerId = 0;
        }

        const autohideEnabled = this.settings.get_boolean('autohide');
        if (!autohideEnabled) {
            this.showDock();
            return;
        }

        // Monitor window focus / position changes to trigger autohide
        this._windowTrackerId = global.display.connect('notify::focus-window', () => {
            this._checkOverlapAndAutohide();
        });

        this._checkOverlapAndAutohide();
    }

    _checkOverlapAndAutohide() {
        if (!this.settings.get_boolean('autohide')) return;

        const focusWindow = global.display.focus_window;
        if (!focusWindow) {
            this.showDock();
            return;
        }

        const windowRect = focusWindow.get_frame_rect();
        const [dockX, dockY] = this.get_transformed_position();
        const [dockW, dockH] = this.get_transformed_size();

        const overlaps = !(
            windowRect.x + windowRect.width < dockX ||
            windowRect.x > dockX + dockW ||
            windowRect.y + windowRect.height < dockY ||
            windowRect.y > dockY + dockH
        );

        if (overlaps && !this.hover) {
            this.hideDock();
        } else {
            this.showDock();
        }
    }

    hideDock() {
        if (this._isHiding) return;
        this._isHiding = true;

        this.ease({
            opacity: 40,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    showDock() {
        this._isHiding = false;
        this.ease({
            opacity: 255,
            duration: 250,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    destroy() {
        if (this._dockAppsChangedId) {
            this.dockManager.disconnect(this._dockAppsChangedId);
        }
        if (this._appStateChangedId) {
            this.dockManager.disconnect(this._appStateChangedId);
        }
        if (this._windowTrackerId) {
            global.display.disconnect(this._windowTrackerId);
        }

        for (const sigId of this._settingSignals) {
            this.settings.disconnect(sigId);
        }

        this.dockManager.destroy();
        super.destroy();
    }
});
