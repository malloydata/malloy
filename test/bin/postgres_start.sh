#! /bin/bash
pg_ctl -D .tmp/data/malloytestdb -l logfile -o "--unix_socket_directories='$PWD'" start
