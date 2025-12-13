import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Button } from "./button";

interface PasswordInputProps extends React.ComponentPropsWithoutRef<"input"> {
  showPassword?: boolean;
  onToggleShowPassword?: () => void;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showPassword, onToggleShowPassword, ...props }, ref) => {
    const [internalShowPassword, setInternalShowPassword] = React.useState(false);
    const isControlled = showPassword !== undefined && onToggleShowPassword !== undefined;
    const isPasswordVisible = isControlled ? showPassword : internalShowPassword;
    const togglePassword = isControlled 
      ? onToggleShowPassword 
      : () => setInternalShowPassword((prev) => !prev);

    return (
      <div className="relative">
        <Input
          type={isPasswordVisible ? "text" : "password"}
          className={cn("pr-10", className)}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={togglePassword}
          disabled={props.disabled}
        >
          {isPasswordVisible ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="sr-only">
            {isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          </span>
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };

