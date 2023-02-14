#!/bin/bash
#
# Install and update Malloy environment in Google Cloud Shell/IDE.
#

samples_repo=https://github.com/malloydata/malloy-samples.git
samples_dir=malloy-samples
composer_latest_api=https://api.github.com/repos/malloydata/malloy-composer/releases/latest

# Save users initial directory
starting_dir="$(pwd)"

log() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')]: $*"
}

err() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')]: $*" >&2
}

### Component Functions ###

#######################################
# Installs a fresh copy of the Malloy Extension.
# Arguments:
#   None
# TODO(maden): Update this to be dynamic
#######################################
install_extension() {
  log "Installing Extension:"
  local extension_file="malloy-vscode-linux-x64-0.2.0.vsix"

  local extension_url="https://www.scullinsteel.com/$extension_file"
  local theia_dir=".theia/extensions"

  local extension_dir=${extension_file%.vsix}

  log "  Creating directory: ~/$theia_dir/$extension_dir"
  cd ~

  if [ -d $theia_dir/$extension_dir ]; then
    log "  Found existing version..."
    log "  Removing existing version..."
    rm -Rf $theia_dir/$extension_dir;
  fi

  mkdir -p $theia_dir/$extension_dir

  cd $theia_dir

  log "  Downloading Extension..."
  curl $extension_url --output $extension_file

  log "  Unpacking Exension..."
  unzip -d $extension_dir $extension_file

  log "  Extension Installed Successfully"
}

#######################################
# Creates a new clone of the malloy-samples repository.
# Arguments:
#   None
# TODO(maden): How to update, pull latest? nuke and reclone?
#######################################
install_samples() {
  log "Installing Samples:"

  cd ~
  log "  Cloning samples repo from: $samples_repo"

  if [ -d $samples_dir ]; then
    log "  Found existing samples..."
    log "  Removing existing samples...."
    rm -Rf $samples_dir
  fi

  git clone $samples_repo
  log "  Samples Installed Successfully"
}

#######################################
# Downloads the latest release of composer from malloy-composer repo.
# Arguments:
#   None
#######################################
install_composer() {
  log "Installing Composer:"

  cd ~
  log "  Fetching latest version..."
  local latest_url=$(curl -s $composer_latest_api | jq -r ".assets[] | select(.name|match(\"linux-x64.zip\")) | .browser_download_url")
  local latest_zip=${latest_url##*/}
  local version_base=${latest_url%/$latest_zip}
  local version=${version_base##*/}

  log "  Latest version found: $version"
  log "  Pulling from: $latest_url"
  curl -L $latest_url --output $latest_zip

  log "  Unpacking composer executable"
  unzip -p $latest_zip composer > composer
  chmod a+x composer

  rm $latest_zip

  log "  Composer Installed Successfully"
}

#######################################
# Updates theia workspace settings to set cloud project id.
# Arguments:
#   PROJECT_ID
#######################################
configure_cloud_project() {
  log "Configuring Cloud Project:"

  cd ~
  log "  Updating workspace settings..."
  cat .theia/settings.json | jq '."cloudcode.cloudshell.project" = $project_id' --arg project_id $1 > settings.json

  if [ $? -eq 0 ]; then
    mv settings.json .theia/settings.json
    log "  Workspace Cloud Project ID has been updated"
  else
    err "  An error occurred updating workspace settings"
  fi
}

#######################################
# Create a small update script in the home directory for updating malloy components.
# Arguments:
#   None
#######################################
write_update_script() {
  cd ~
  local update_file=update_malloy.sh

  echo "#!/bin/bash" > $update_file
  echo "curl -s https://raw.githubusercontent.com/malloydata/malloy/maden/cloud-ide-setup/scripts/cloud/update_malloy.sh | bash" >> $update_file
  chmod a+x $update_file
}

### Main execution block ###
install_extension
install_samples
install_composer

if [[ -n $1 ]]; then
  configure_cloud_project $1
fi

write_update_script

# Return to starting directory
cd $starting_dir
