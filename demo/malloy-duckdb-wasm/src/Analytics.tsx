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

import React, { useCallback, useState } from "react";
import styled from "styled-components";

declare const GA_SITE_ID: string;

export const Analytics: React.FC = () => {
  let cookieClicked = false;
  try {
    cookieClicked = localStorage.getItem("cookie-clicked") === "yes";
  } catch {
    // Ignore
  }

  const [showBanner, setShowBanner] = useState(!cookieClicked);
  const onClick = useCallback(() => {
    try {
      localStorage.setItem("cookie-clicked", "yes");
    } catch {
      // Ignore
    }
    setShowBanner(false);
  }, []);

  if (!GA_SITE_ID) {
    return null;
  }

  return (
    <>
      {showBanner ? (
        <Banner>
          <div>
            This site uses cookies from Google to deliver its services and to
            analyze traffic.{" "}
            <a
              href="https://policies.google.com/technologies/cookies"
              target="_blank"
            >
              Learn more
            </a>
          </div>
          <button onClick={onClick}>I Understand</button>
        </Banner>
      ) : null}
    </>
  );
};

const Banner = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  font-size: 16px;
  bottom: 0;
  height: 60px;
  width: 80%;
  max-width: 1000px;
  background: #2655c9;
  color: white;
  padding: 0 20px;

  button {
    border: 0;
    background: white;
    color: #2655c9;
    height: 30px;
    width: 120px;
    border-radius: 3px;
  }

  a {
    color: white;
  }
`;
