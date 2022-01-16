with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-16_x yarn jdk8 google-cloud-sdk postgresql jekyll]; }
