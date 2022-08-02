/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { ReactComponent as ChannelIconAbout } from "../assets/img/channel_icons/channel_about.svg";
import { ReactComponent as ChannelIconFeedback } from "../assets/img/channel_icons/channel_feedback.svg";
import { ReactComponent as ChannelIconHelp } from "../assets/img/channel_icons/channel_help.svg";
import { ReactComponent as ChannelIconPreview } from "../assets/img/channel_icons/channel_preview.svg";
import { ReactComponent as ChannelIconQuery } from "../assets/img/channel_icons/channel_query.svg";
import { ReactComponent as ChannelIconSamples } from "../assets/img/channel_icons/channel_samples.svg";
import { ReactComponent as ChannelIconSettings } from "../assets/img/channel_icons/channel_settings.svg";
import { ReactComponent as ChannelIconSource } from "../assets/img/channel_icons/channel_source.svg";

type ChannelIconName = "about" | "feedback" | "help" | "preview" | "query" | "samples" | "settings" | "source";

export const ChannelIcon: React.FC<{ name: ChannelIconName }> = ({ name }) => {
  const sizeProps = { width: "18px", height: "18px" };
  switch (name) {
    case "about":
      return <ChannelIconAbout {...sizeProps} />;
    case "feedback":
      return <ChannelIconFeedback {...sizeProps} />;
    case "help":
      return <ChannelIconHelp {...sizeProps} />;
    case "preview":
      return <ChannelIconPreview {...sizeProps} />;
    case "query":
      return <ChannelIconQuery {...sizeProps} />;
    case "samples":
      return <ChannelIconSamples {...sizeProps} />;
    case "settings":
      return <ChannelIconSettings {...sizeProps} />;
    case "source":
      return <ChannelIconSource {...sizeProps} />;
  }
};
