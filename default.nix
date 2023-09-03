with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-18_x jdk8 google-cloud-sdk postgresql git cacert openssh jq fakeroot]; }
