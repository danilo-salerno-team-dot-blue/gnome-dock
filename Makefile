EXTENSION_UUID = mac-ubuntu-dock@danilo.projects
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)

.PHONY: all schemas install uninstall pack clean restart-shell

all: schemas

schemas:
	@echo "Compiling GSettings schemas..."
	glib-compile-schemas schemas/

install: schemas
	@echo "Installing extension to $(INSTALL_DIR)..."
	mkdir -p $(INSTALL_DIR)
	cp -r metadata.json stylesheet.css extension.js prefs.js dockContainer.js dockItem.js dockManager.js schemas $(INSTALL_DIR)/
	@echo "Extension installed successfully!"
	@echo "Enabling extension..."
	-gnome-extensions enable $(EXTENSION_UUID)
	@echo "Done! You can open preferences with: gnome-extensions prefs $(EXTENSION_UUID)"

uninstall:
	@echo "Removing extension from $(INSTALL_DIR)..."
	-gnome-extensions disable $(EXTENSION_UUID)
	rm -rf $(INSTALL_DIR)
	@echo "Uninstalled."

pack: schemas
	@echo "Packing extension bundle..."
	gnome-extensions pack --force --extra-source=dockContainer.js --extra-source=dockItem.js --extra-source=dockManager.js
	@echo "Package created!"

restart-shell:
	@echo "Restarting GNOME Shell..."
	busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting...")' || true
