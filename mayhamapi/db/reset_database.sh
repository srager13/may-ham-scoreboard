#!/bin/bash

psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f ./reset_database.sql