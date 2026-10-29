with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs_20 jdk8 google-cloud-sdk postgresql git cacert openssh jq fakeroot]; }
