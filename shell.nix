let
  sources = import ./nix/sources.nix;
  pkgs = import sources.nixpkgs { };
in
with pkgs;
mkShell {
  packages = [
    nodejs-16_x
    jdk8
    google-cloud-sdk
    postgresql
    ruby.devEnv
    git
    cacert
    openssh
    jq
    fakeroot
    nixpkgs-fmt
  ];
}
