import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

export const DockItemType = {
    APP: 'app',
    LAUNCHER: 'launcher',
    TRASH: 'trash',
};

export const DockItem = GObject.registerClass({
    GTypeName: 'GnomeDockItem',
}, class DockItem extends St.Button {
    _init(itemType, app = null, settings = null, iconSize = 48) {
        super._init({
            style_class: 'dock-item-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        this.itemType = itemType;
        this.app = app;
        this.settings = settings;
        this.baseIconSize = iconSize;
        this.currentScale = 1.0;

        // Main layout container inside button
        this._box = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.set_child(this._box);

        // Icon Container
        this._iconContainer = new St.Bin({
            width: this.baseIconSize,
            height: this.baseIconSize,
        });
        this._box.add_child(this._iconContainer);

        // Active indicator container
        this._indicator = new St.Widget({
            style_class: 'dock-indicator dock-indicator-dot',
            visible: false,
        });
        this._box.add_child(this._indicator);

        this._setupIcon();
        this._setupEvents();
        this.updateState();
    }

    _setupIcon() {
        this._iconContainer.destroy_all_children();

        if (this.itemType === DockItemType.LAUNCHER) {
            const icon = new St.Icon({
                icon_name: 'view-app-grid-symbolic',
                icon_size: this.baseIconSize,
                style_class: 'dock-launcher-icon',
            });
            this._iconContainer.set_child(icon);
            this.style_class = 'dock-item-button dock-launcher-button';
        } else if (this.itemType === DockItemType.TRASH) {
            const icon = new St.Icon({
                icon_name: 'user-trash-symbolic',
                icon_size: this.baseIconSize,
                style_class: 'dock-trash-icon',
            });
            this._iconContainer.set_child(icon);
            this.style_class = 'dock-item-button dock-trash-button';
        } else if (this.app) {
            let iconWidget = null;
            try {
                if (typeof this.app.create_icon_texture === 'function') {
                    iconWidget = this.app.create_icon_texture(this.baseIconSize);
                }
            } catch (e) {
                // Fallback icon creation
            }

            if (!iconWidget) {
                let iconName = 'application-x-executable';
                const appInfo = this.app.get_app_info?.();
                if (appInfo && appInfo.get_icon?.()) {
                    const gicon = appInfo.get_icon();
                    iconWidget = new St.Icon({
                        gicon: gicon,
                        icon_size: this.baseIconSize,
                    });
                } else {
                    iconWidget = new St.Icon({
                        icon_name: iconName,
                        icon_size: this.baseIconSize,
                    });
                }
            }
            this._iconContainer.set_child(iconWidget);
        }
    }

    setIconSize(size) {
        this.baseIconSize = size;
        this._iconContainer.set_size(
            Math.round(this.baseIconSize * this.currentScale),
            Math.round(this.baseIconSize * this.currentScale)
        );
        this._setupIcon();
    }

    setScale(scale) {
        this.currentScale = scale;
        const scaledSize = Math.round(this.baseIconSize * scale);
        this._iconContainer.set_size(scaledSize, scaledSize);
    }

    updateState() {
        if (this.itemType !== DockItemType.APP || !this.app) {
            this._indicator.hide();
            return;
        }

        const state = this.app.state;
        const isRunning = state === Shell.AppState.RUNNING;

        if (isRunning) {
            this._indicator.show();

            const indicatorStyle = this.settings?.get_string('indicator-style') || 'dot';
            if (indicatorStyle === 'bar') {
                this._indicator.style_class = 'dock-indicator dock-indicator-bar';
            } else if (indicatorStyle === 'line') {
                this._indicator.style_class = 'dock-indicator dock-indicator-line';
            } else {
                this._indicator.style_class = 'dock-indicator dock-indicator-dot';
            }
        } else {
            this._indicator.hide();
        }
    }

    _setupEvents() {
        this.connect('clicked', (actor, button) => {
            if (button === 1) { // Left click
                this._onPrimaryClick();
            } else if (button === 2) { // Middle click
                this._onMiddleClick();
            }
        });

        // Context Menu on Right-Click
        const clickAction = new Clutter.ClickAction();
        clickAction.connect('clicked', (action) => {
            if (action.get_button() === 3) {
                this._showContextMenu();
            }
        });
        this.add_action(clickAction);

        // Hover tooltip management
        this.connect('notify::hover', () => {
            if (this.hover) {
                this._showTooltip();
            } else {
                this._hideTooltip();
            }
        });
    }

    _onPrimaryClick() {
        if (this.itemType === DockItemType.LAUNCHER) {
            Main.overview.toggle();
        } else if (this.itemType === DockItemType.TRASH) {
            try {
                Gio.AppInfo.launch_default_for_uri('trash:///', null);
            } catch (e) {
                logError(e, 'Failed to open trash');
            }
        } else if (this.app) {
            if (this.app.state === Shell.AppState.RUNNING) {
                const windows = this.app.get_windows();
                if (windows.length > 0) {
                    const activeWin = windows.find(w => w.has_focus());
                    if (activeWin && windows.length === 1) {
                        activeWin.minimize();
                    } else {
                        this.app.activate();
                    }
                } else {
                    this.app.activate();
                }
            } else {
                this.app.open_new_window(-1);
            }
        }
    }

    _onMiddleClick() {
        if (this.itemType === DockItemType.APP && this.app) {
            this.app.open_new_window(-1);
        }
    }

    _showContextMenu() {
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }

        this._menu = new PopupMenu.PopupMenu(this, 0.5, BoxPointer.PopupAnimation.FULL);

        if (this.itemType === DockItemType.LAUNCHER) {
            const header = new PopupMenu.PopupMenuItem('App Grid / Overview', { reactive: false });
            this._menu.addMenuItem(header);
        } else if (this.itemType === DockItemType.TRASH) {
            const openTrash = new PopupMenu.PopupMenuItem('Open Trash');
            openTrash.connect('activate', () => {
                Gio.AppInfo.launch_default_for_uri('trash:///', null);
            });
            this._menu.addMenuItem(openTrash);

            const emptyTrash = new PopupMenu.PopupMenuItem('Empty Trash');
            emptyTrash.connect('activate', () => {
                try {
                    const proc = new Gio.Subprocess({
                        argv: ['gio', 'trash', '--empty'],
                        flags: Gio.SubprocessFlags.NONE,
                    });
                    proc.init(null);
                } catch (e) {
                    logError(e, 'Failed to empty trash');
                }
            });
            this._menu.addMenuItem(emptyTrash);
        } else if (this.app) {
            // App name header
            const titleItem = new PopupMenu.PopupMenuItem(this.app.get_name(), { reactive: false });
            this._menu.addMenuItem(titleItem);
            this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // New window option
            const newWindowItem = new PopupMenu.PopupMenuItem('New Window');
            newWindowItem.connect('activate', () => {
                this.app.open_new_window(-1);
            });
            this._menu.addMenuItem(newWindowItem);

            // Pin / Unpin
            const favoriteAppSet = new Set(
                (global.settings?.get_strv('favorite-apps') || [])
            );
            const appId = this.app.get_id();
            const isFavorite = favoriteAppSet.has(appId);

            const pinItem = new PopupMenu.PopupMenuItem(
                isFavorite ? 'Unpin from Dock' : 'Pin to Dock'
            );
            pinItem.connect('activate', () => {
                let favorites = global.settings?.get_strv('favorite-apps') || [];
                if (isFavorite) {
                    favorites = favorites.filter(id => id !== appId);
                } else {
                    favorites.push(appId);
                }
                global.settings?.set_strv('favorite-apps', favorites);
            });
            this._menu.addMenuItem(pinItem);

            // Quit app option
            if (this.app.state === Shell.AppState.RUNNING) {
                this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                const quitItem = new PopupMenu.PopupMenuItem('Quit');
                quitItem.connect('activate', () => {
                    this.app.request_quit();
                });
                this._menu.addMenuItem(quitItem);
            }
        }

        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.open();
    }

    _showTooltip() {
        if (!this.settings?.get_boolean('show-tooltips')) return;

        let labelText = '';
        if (this.itemType === DockItemType.LAUNCHER) {
            labelText = 'Applications';
        } else if (this.itemType === DockItemType.TRASH) {
            labelText = 'Trash';
        } else if (this.app) {
            labelText = this.app.get_name();
        }

        if (!labelText) return;

        if (!this._tooltip) {
            this._tooltip = new St.Label({
                text: labelText,
                style_class: 'dock-tooltip',
                visible: false,
            });
            Main.layoutManager.addChrome(this._tooltip, { affectsInputRegion: false });
        } else {
            this._tooltip.text = labelText;
        }

        const [stageX, stageY] = this.get_transformed_position();
        const [width, height] = this.get_transformed_size();

        const position = this.settings?.get_string('dock-position') || 'bottom';
        let tooltipX = stageX + (width / 2) - 35;
        let tooltipY = stageY - 40;

        if (position === 'top') {
            tooltipY = stageY + height + 8;
        } else if (position === 'left') {
            tooltipX = stageX + width + 8;
            tooltipY = stageY + (height / 2) - 15;
        } else if (position === 'right') {
            tooltipX = stageX - 85;
            tooltipY = stageY + (height / 2) - 15;
        }

        this._tooltip.set_position(Math.max(10, tooltipX), Math.max(10, tooltipY));
        this._tooltip.show();
    }

    _hideTooltip() {
        if (this._tooltip) {
            this._tooltip.hide();
        }
    }

    destroy() {
        this._hideTooltip();
        if (this._tooltip) {
            Main.layoutManager.removeChrome(this._tooltip);
            this._tooltip.destroy();
            this._tooltip = null;
        }
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }
        super.destroy();
    }
});
