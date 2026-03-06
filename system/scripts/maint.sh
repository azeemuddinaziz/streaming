#!/bin/bash

FILE="/var/www/html/maintenance.on"
HTML_PATH="/var/www/streaming/system/html/Maintenance.html"

if [ "$1" == "on" ]; then
    # Check if file exists before running sed
    if [ ! -f "$HTML_PATH" ]; then
        echo "Error: Cannot find $HTML_PATH"
        echo "Check if the filename is maintenance.html (lowercase) instead?"
        exit 1
    fi

    if [ ! -z "$2" ]; then
        # The '|| echo' handles cases where sed might fail
        sudo sed -i "s|<p id=\"maint-msg\">.*</p>|<p id=\"maint-msg\">$2</p>|g" "$HTML_PATH" || echo "Warning: Message update failed."
    fi
    sudo touch $FILE
    sudo systemctl reload nginx
    echo "--- Maintenance Mode ENABLED ---"
elif [ "$1" == "off" ]; then
    sudo rm -f $FILE
    sudo systemctl reload nginx
    echo "--- Maintenance Mode DISABLED ---"
else
    echo "Usage: ./maint.sh [on|off] \"Optional Message\""
fi