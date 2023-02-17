#!/bin/bash
#
# Install and update Malloy environment in Google Cloud Shell/IDE.
#

samples_repo=https://github.com/malloydata/malloy-samples.git
samples_dir=malloy-samples
composer_latest_api=https://api.github.com/repos/malloydata/malloy-composer/releases/latest
extension_latest_api=https://api.github.com/repos/malloydata/malloy-vscode-extension/releases/latest

# Save users initial directory
starting_dir="$(pwd)"

log() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')]: $*"
}

err() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S%z')]:(ERROR) $*" >&2
}

fatal() {
  err $*
  exit 1
}

### Component Functions ###

#######################################
# Installs a fresh copy of the Malloy Extension.
# Arguments:
#   None
#######################################
install_extension() {
  log "Installing Extension:"

  log "  Fetching latest version number..."
  local latest_url
  latest_url=$(curl -s $extension_latest_api | jq -r ".assets[] | select(.name|match(\".vsix\")) | .browser_download_url")
  if [ $? -ne 0 ]; then
    fatal "Error while parsing github api for latest version"
  fi

  local latest_vsix=${latest_url##*/}
  local version_base=${latest_url%/$latest_vsix}
  local version=${version_base##*/}

  log "  Latest version found: $version"

  local theia_dir=".theia/extensions"

  local extension_dir=${latest_vsix%.vsix}

  log "  Creating directory: ~/$theia_dir/$extension_dir"
  cd ~

  if [ -d $theia_dir/$extension_dir ]; then
    log "  Found existing version..."
    log "  Removing existing version..."
    if ! rm -Rf $theia_dir/$extension_dir; then
      fatal "Unable to remove existing extesion version"
    fi
  fi

  if ! mkdir -p $theia_dir/$extension_dir; then
    fatal "Unable to create extension directory"
  fi

  cd $theia_dir

  log "  Pulling from: $latest_url"
  if ! curl -L $latest_url --output $latest_vsix; then
    fatal "Error downloading latest release package"
  fi

  log "  Unpacking Exension..."
  if ! unzip -d $extension_dir $latest_vsix; then
    fatal "Error occurred while unpacking extension"
  fi

  # Force IDE to reload so it will pickup the new extension
  killall node

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
    if ! rm -Rf $samples_dir; then
      fatal "Unable to remove existing samples directory"
    fi
  fi

  if ! git clone $samples_repo; then
    fatal "Failed to clone samples repository"
  fi
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
  local latest_url
  latest_url=$(curl -s $composer_latest_api | jq -r ".assets[] | select(.name|match(\"linux-x64.zip\")) | .browser_download_url")
  if [ $? -ne 0 ]; then
    fatal "Error while parsing github api for latest version"
  fi

  local latest_zip=${latest_url##*/}
  local version_base=${latest_url%/$latest_zip}
  local version=${version_base##*/}

  log "  Latest version found: $version"
  log "  Pulling from: $latest_url"
  if ! curl -L $latest_url --output $latest_zip; then
    fatal "Error downloading latest release package"
  fi

  log "  Unpacking composer executable"
  if ! unzip -p $latest_zip composer > composer; then
    fatal "Error unpacking executable from zip"
  fi
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
    if ! mv settings.json .theia/settings.json; then
      err "Failed to write settings update"
    fi
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

#######################################
# Main function call
# Arguments:
#   PROJECT_ID
#######################################
main() {
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
}

main "$@"