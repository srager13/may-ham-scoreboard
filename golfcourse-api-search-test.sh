#!/bin/bash

COURSE=tidewater
COURSES_DIR=golfcourses

mkdir -p $COURSES_DIR

curl https://api.golfcourseapi.com/v1/search?search_query=$COURSE -s -H \
 "Authorization: Key WKTSEX3UKGXJ6IISKYEBH7UNPY" > $COURSES_DIR/$COURSE.json