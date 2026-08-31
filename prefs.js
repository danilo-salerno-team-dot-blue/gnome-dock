import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class GnomeDockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // ----------------------------------------------------
        // PAGE 1: Appearance & Presets
        // ----------------------------------------------------
        const pageAppearance = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        window.add(pageAppearance);

        const groupPresets = new Adw.PreferencesGroup({
            title: 'Dock Style Preset',
            description: 'Choose layout and theme style preset',
        });
        pageAppearance.add(groupPresets);

        // Preset Combo
        const presetModel = Gtk.StringList.new([
            'GNOME 3D Shelf',
            'Glassmorphic Pill',
            'Charcoal Dark Accent',
            'Classic Dark'
        ]);
        const presetRow = new Adw.ComboRow({
            title: 'Style Preset',
            subtitle: 'Pre-configured design theme',
            model: presetModel,
        });

        const presetMap = ['leopard', 'glass', 'charcoal', 'classic'];
        const currentPreset = settings.get_string('dock-preset');
        const presetIdx = presetMap.indexOf(currentPreset);
        if (presetIdx >= 0) presetRow.selected = presetIdx;

        presetRow.connect('notify::selected', () => {
            const selectedStr = presetMap[presetRow.selected];
            settings.set_string('dock-preset', selectedStr);

            if (selectedStr === 'leopard') {
                settings.set_string('indicator-style', 'dot');
                settings.set_int('dock-corner-radius', 12);
                settings.set_boolean('enable-magnification', true);
            } else if (selectedStr === 'glass') {
                settings.set_string('indicator-style', 'dot');
                settings.set_int('dock-corner-radius', 24);
                settings.set_boolean('enable-magnification', true);
            } else if (selectedStr === 'charcoal') {
                settings.set_string('indicator-style', 'bar');
                settings.set_int('dock-corner-radius', 12);
            }
        });
        groupPresets.add(presetRow);

        // Position Combo
        const posModel = Gtk.StringList.new(['Bottom', 'Left', 'Right', 'Top']);
        const posRow = new Adw.ComboRow({
            title: 'Dock Position',
            subtitle: 'Screen edge placement for dock',
            model: posModel,
        });
        const posMap = ['bottom', 'left', 'right', 'top'];
        const currentPos = settings.get_string('dock-position');
        const posIdx = posMap.indexOf(currentPos);
        if (posIdx >= 0) posRow.selected = posIdx;

        posRow.connect('notify::selected', () => {
            settings.set_string('dock-position', posMap[posRow.selected]);
        });
        groupPresets.add(posRow);

        // Group Layout Options
        const groupLayout = new Adw.PreferencesGroup({
            title: 'Dimensions & Opacity',
        });
        pageAppearance.add(groupLayout);

        // Icon Size Spin Button
        const iconSizeSpin = Gtk.SpinButton.new_with_range(24, 96, 4);
        iconSizeSpin.value = settings.get_int('icon-size');
        iconSizeSpin.connect('value-changed', () => {
            settings.set_int('icon-size', iconSizeSpin.get_value_as_int());
        });
        const iconSizeRow = new Adw.ActionRow({
            title: 'Icon Size (px)',
            subtitle: 'Base size of dock app icons',
        });
        iconSizeRow.add_suffix(iconSizeSpin);
        groupLayout.add(iconSizeRow);

        // Corner Radius Spin Button
        const radiusSpin = Gtk.SpinButton.new_with_range(0, 40, 2);
        radiusSpin.value = settings.get_int('dock-corner-radius');
        radiusSpin.connect('value-changed', () => {
            settings.set_int('dock-corner-radius', radiusSpin.get_value_as_int());
        });
        const radiusRow = new Adw.ActionRow({
            title: 'Corner Radius (px)',
            subtitle: 'Roundness of dock background border',
        });
        radiusRow.add_suffix(radiusSpin);
        groupLayout.add(radiusRow);

        // Translucency Spin Button
        const alphaSpin = Gtk.SpinButton.new_with_range(0.1, 1.0, 0.05);
        alphaSpin.digits = 2;
        alphaSpin.value = settings.get_double('dock-translucency');
        alphaSpin.connect('value-changed', () => {
            settings.set_double('dock-translucency', alphaSpin.get_value());
        });
        const alphaRow = new Adw.ActionRow({
            title: 'Background Translucency',
            subtitle: 'Opacity level of the dock panel (0.1 to 1.0)',
        });
        alphaRow.add_suffix(alphaSpin);
        groupLayout.add(alphaRow);

        // ----------------------------------------------------
        // PAGE 2: Behavior & FX
        // ----------------------------------------------------
        const pageBehavior = new Adw.PreferencesPage({
            title: 'Behavior & Effects',
            icon_name: 'emblem-system-symbolic',
        });
        window.add(pageBehavior);

        const groupFX = new Adw.PreferencesGroup({
            title: 'Interactive Features',
        });
        pageBehavior.add(groupFX);

        // Auto-Hide Switch
        const autoHideRow = new Adw.SwitchRow({
            title: 'Intelligent Auto-Hide',
            subtitle: 'Automatically hide dock when open windows overlap',
        });
        settings.bind('autohide', autoHideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupFX.add(autoHideRow);

        // Magnification Switch
        const magRow = new Adw.SwitchRow({
            title: 'Icon Magnification',
            subtitle: 'Smoothly expand icons as cursor moves over them',
        });
        settings.bind('enable-magnification', magRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupFX.add(magRow);

        // Magnification Scale Spin
        const magScaleSpin = Gtk.SpinButton.new_with_range(1.1, 2.2, 0.1);
        magScaleSpin.digits = 1;
        magScaleSpin.value = settings.get_double('magnification-scale');
        magScaleSpin.connect('value-changed', () => {
            settings.set_double('magnification-scale', magScaleSpin.get_value());
        });
        const magScaleRow = new Adw.ActionRow({
            title: 'Max Magnification Factor',
            subtitle: 'Peak zoom level on mouse hover proximity',
        });
        magScaleRow.add_suffix(magScaleSpin);
        groupFX.add(magScaleRow);

        // Indicator Style Combo
        const indModel = Gtk.StringList.new(['Glowing Dot', 'Accent Bar', 'Accent Line']);
        const indRow = new Adw.ComboRow({
            title: 'Running App Indicator Style',
            subtitle: 'Visual marker below running applications',
            model: indModel,
        });
        const indMap = ['dot', 'bar', 'line'];
        const currentInd = settings.get_string('indicator-style');
        const indIdx = indMap.indexOf(currentInd);
        if (indIdx >= 0) indRow.selected = indIdx;

        indRow.connect('notify::selected', () => {
            settings.set_string('indicator-style', indMap[indRow.selected]);
        });
        groupFX.add(indRow);

        // ----------------------------------------------------
        // PAGE 3: Dock Elements
        // ----------------------------------------------------
        const pageElements = new Adw.PreferencesPage({
            title: 'Dock Items',
            icon_name: 'preferences-desktop-apps-symbolic',
        });
        window.add(pageElements);

        const groupItems = new Adw.PreferencesGroup({
            title: 'Special Dock Buttons',
        });
        pageElements.add(groupItems);

        // App Launcher Switch
        const launcherRow = new Adw.SwitchRow({
            title: 'Show Applications Grid Launcher',
            subtitle: 'Launchpad / Overview button on dock',
        });
        settings.bind('show-launcher', launcherRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupItems.add(launcherRow);

        // Launcher Position Combo
        const launchPosModel = Gtk.StringList.new(['Start of Dock', 'End of Dock']);
        const launchPosRow = new Adw.ComboRow({
            title: 'Launcher Position',
            subtitle: 'Placement of App Grid button',
            model: launchPosModel,
        });
        const launchPosMap = ['start', 'end'];
        const currentLaunchPos = settings.get_string('launcher-position');
        const launchIdx = launchPosMap.indexOf(currentLaunchPos);
        if (launchIdx >= 0) launchPosRow.selected = launchIdx;

        launchPosRow.connect('notify::selected', () => {
            settings.set_string('launcher-position', launchPosMap[launchPosRow.selected]);
        });
        groupItems.add(launchPosRow);

        // Trash Bin Switch
        const trashRow = new Adw.SwitchRow({
            title: 'Show Trash Bin Icon',
            subtitle: 'Trash shortcut on dock',
        });
        settings.bind('show-trash', trashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupItems.add(trashRow);

        // Tooltips Switch
        const tooltipRow = new Adw.SwitchRow({
            title: 'Show Hover App Tooltips',
            subtitle: 'Display popover text with application names',
        });
        settings.bind('show-tooltips', tooltipRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupItems.add(tooltipRow);
    }
}
