import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SmartNewsImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading?: "eager" | "lazy";
  objectPosition?: string;
  fit?: "cover" | "safe";
  className?: string;
};

export function SmartNewsImage({
  src,
  alt,
  width,
  height,
  loading,
  objectPosition = "center center",
  fit = "cover",
  className,
}: SmartNewsImageProps) {
  const isSafe = fit === "safe";
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "aspect-[4/3] w-full bg-[linear-gradient(135deg,#e8e1d4,#f8f5ee_48%,#d6cdbf)]",
          className,
        )}
      />
    );
  }

  return (
    <>
      {isSafe ? (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl md:hidden"
          style={{ objectPosition }}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        className={cn(
          "relative h-auto w-full object-contain",
          isSafe ? "md:object-contain" : "md:object-cover",
          "md:relative md:inset-auto md:h-auto md:w-full md:object-contain",
          className,
        )}
        style={{ objectPosition }}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    </>
  );
}
