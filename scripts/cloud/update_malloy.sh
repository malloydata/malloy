#!/bin/bash

samples_repo=https://github.com/malloydata/malloy-samples.git
samples_dir=malloy-samples
composer_latest_api=https://api.github.com/repos/malloydata/malloy-composer/releases/latest

# Save users initial directory
starting_dir="$(pwd)"

### Component Functions ###
# TODO(maden): Update this to be dynamic
install_extension() {
  echo "Installing Extension:"
  extension_file="malloy-vscode-linux-x64-0.2.0.vsix"

  extension_url="https://www.scullinsteel.com/$extension_file"
  theia_dir=".theia/extensions"

  extension_dir=${extension_file%.vsix}

  echo "  Creating directory: ~/$theia_dir/$extension_dir"
  cd ~

  if [ -d $theia_dir/$extension_dir ]; then
    echo "  Found existing version..."
    echo "  Removing existing version..."
    rm -Rf $theia_dir/$extension_dir;
  fi

  mkdir -p $theia_dir/$extension_dir

  cd $theia_dir

  echo "  Downloading Extension..."
  curl $extension_url --output $extension_file

  echo "  Unpacking Exension..."
  unzip -d $extension_dir $extension_file

  echo "  Extension Installed Successfully"
}

# TODO(maden): How to update, pull latest? nuke and reclone?
install_samples() {
  echo "Installing Samples:"

  cd ~
  echo "  Cloning samples repo from: $samples_repo"

  if [ -d $samples_dir ]; then
    echo "  Found existing samples..."
    echo "  Removing existing samples...."
    rm -Rf $samples_dir
  fi

  git clone $samples_repo
  echo "  Samples Installed Successfully"
}

install_composer() {
  echo "Installing Composer:"

  cd ~
  echo "  Fetching latest version..."
  latest_url=$(curl -s $composer_latest_api | jq -r ".assets[] | select(.name|match(\"linux-x64.zip\")) | .browser_download_url")
  latest_zip=${latest_url##*/}
  version_base=${latest_url%/$latest_zip}
  version=${version_base##*/}

  echo "  Latest version found: $version"
  echo "  Pulling from: $latest_url"
  curl -L $latest_url --output $latest_zip

  echo "  Unpacking composer executable"
  unzip -p $latest_zip composer > composer
  chmod a+x composer

  rm $latest_zip

  echo " Composer Installed Successfully"
}

configure_cloud_project() {
  cd ~

  echo -n "Enter your cloud platform project [PROJECT_ID]: "
  read -r project_id

  cat .theia/settings.json | jq '."cloudcode.cloudshell.project" = $project_id' --arg project_id $project_id > settings.json
  mv settings.json .theia/settings.json

  echo "Workspace Cloud Project ID has been updated"
}

### Main execution block ###
install_extension
install_samples
install_composer


echo -n "Configure cloud project? [y/n]: "
read -r ans

positive_response='[yY]'
if [[ $ans =~ $positive_response ]]; then
  configure_cloud_project
fi

# Return to starting directory
cd $starting_dir
