import Shell from 'gi://Shell';
import GObject from 'gi://GObject';

export const DockManager = GObject.registerClass({
    GTypeName: 'GnomeDockManager',
    Signals: {
        'dock-apps-changed': {},
        'app-state-changed': { param_types: [Shell.App.$gtype] },
    },
}, class DockManager extends GObject.Object {
    _init() {
        super._init();
        this._appSystem = Shell.AppSystem.get_default();

        this._signals = [];

        this._signals.push(
            this._appSystem.connect('app-state-changed', (sys, app) => {
                this.emit('app-state-changed', app);
                this.emit('dock-apps-changed');
            })
        );

        this._signals.push(
            this._appSystem.connect('installed-changed', () => {
                this.emit('dock-apps-changed');
            })
        );

        if (global.settings) {
            this._signals.push(
                global.settings.connect('changed::favorite-apps', () => {
                    this.emit('dock-apps-changed');
                })
            );
        }
    }

    getDockApps() {
        const favoriteIds = global.settings?.get_strv('favorite-apps') || [];
        const favorites = [];
        const runningOnly = [];

        // 1. Get favorite apps
        for (const id of favoriteIds) {
            const app = this._appSystem.lookup_app(id);
            if (app) {
                favorites.push({ app, isFavorite: true });
            }
        }

        // 2. Get running apps that are not in favorites
        const runningApps = this._appSystem.get_running();
        const favoriteSet = new Set(favoriteIds);

        for (const app of runningApps) {
            const id = app.get_id();
            if (id && !favoriteSet.has(id)) {
                runningOnly.push({ app, isFavorite: false });
            }
        }

        return { favorites, runningOnly };
    }

    destroy() {
        for (const id of this._signals) {
            if (global.settings) {
                global.settings.disconnect(id);
            }
            this._appSystem.disconnect(id);
        }
        this._signals = [];
    }
});
