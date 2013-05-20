#!/bin/sh
cur_path=$(dirname $0);
zip -x.git/* -xpackage.sh   -r $cur_path/plasmoid-hwmon.zip $cur_path