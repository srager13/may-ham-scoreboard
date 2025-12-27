#!/bin/bash

ID=24973
COURSES_DIR=golfcourses

curl https://api.golfcourseapi.com/v1/courses/24973 -s -H \
 "Authorization: Key WKTSEX3UKGXJ6IISKYEBH7UNPY" > $COURSES_DIR/$ID.json