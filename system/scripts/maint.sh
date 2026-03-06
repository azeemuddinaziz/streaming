#!/bin/bash

FILE="/var/www/html/maintenance.on"
HTML_PATH="/var/www/streaming/system/html/Maintenance.html"

if [ "$1" == "on" ]; then
    # Optional: Update the message if a second argument is provided
    if [ ! -z "$2" ]; then
        sudo sed -i "s|<p id=\"maint-msg\">.*</p>|<p id=\"maint-msg\">$2</p>|g" $HTML_PATH
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