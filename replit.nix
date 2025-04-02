{pkgs}: {
  deps = [
    pkgs.glib
    pkgs.lsof
  ];
}
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [
    pkgs.nss
  ];
}