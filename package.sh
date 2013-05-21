#!/bin/sh
cur_path=$(dirname $0);

if [ -f "$cur_path/plasmoid-hwmon.plasmoid" ]
then
    rm $cur_path/plasmoid-hwmon.plasmoid
fi

zip -x.git/* -xpackage.sh   -r $cur_path/plasmoid-hwmon.zip $cur_path
mv $cur_path/plasmoid-hwmon.zip $cur_path/plasmoid-hwmon.plasmoid

# todo: remove bak.js, rename extension