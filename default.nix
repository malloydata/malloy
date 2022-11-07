with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-16_x jdk8 google-cloud-sdk postgresql ruby.devEnv git jq cacert fakeroot]; }
