#!/bin/sh
cur_path=$(dirname $0);

if [ -f "$cur_path/plasmoid-hwmon.plasmoid" ]
then
    rm $cur_path/plasmoid-hwmon.plasmoid
fi

cp -f $cur_path/contents/ui/config.ui{,.bk}
build_time=`date +%Y-%m-%d-%H-%M-%S\(%Z\)`
script_to_exec='s/$PLASMOID_HWMON_BUILD_TIME/'$build_time"/"
sed -i -e $script_to_exec  $cur_path/contents/ui/config.ui

zip -x.git/* -xpackage.sh -xcontents/ui/config.ui.bk   -r $cur_path/plasmoid-hwmon.zip $cur_path
mv $cur_path/plasmoid-hwmon.zip $cur_path/plasmoid-hwmon.plasmoid

mv -f $cur_path/contents/ui/config.ui{.bk,}

# todo: remove bak.js, rename extension