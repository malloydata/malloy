#! /bin/bash
pg_ctl -D .tmp/malloytestdb -l logfile -o "--unix_socket_directories='$PWD'" start
