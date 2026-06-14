import React from "react";

function AppImage({
  src,
  alt = "Image",
  className = "",
  ...props
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        e.target.src = "/assets/images/no_image.png"; // fallback image
      }}
      {...props}
    />
  );
}

export default AppImage;
