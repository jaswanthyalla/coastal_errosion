import React, { useState } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils/cn";
import Button from "./Button";
import Input from "./Input";

const Select = React.forwardRef(({
  className,
  options = [],
  value,
  multiple = false,
  placeholder = "Select an option",
  label,
  description,
  error,
  searchable = false,
  clearable = false,
  disabled = false,
  id,
  onChange,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selectId = id || `select-${Math.random()?.toString(36)?.substr(2, 9)}`;

  const filteredOptions = searchable && searchTerm
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const isSelected = (val) => multiple ? value?.includes(val) : value === val;
  const hasValue = multiple ? value?.length > 0 : value !== undefined && value !== '';

  const handleToggle = () => { if(!disabled) setIsOpen(!isOpen); };
  const handleOptionSelect = (option) => {
    if(multiple){
      const newValue = value || [];
      onChange?.(newValue.includes(option.value) ? newValue.filter(v => v !== option.value) : [...newValue, option.value]);
    } else {
      onChange?.(option.value);
      setIsOpen(false);
    }
  };
  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(multiple ? [] : '');
  };
  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label htmlFor={selectId} className={cn("text-sm font-medium mb-2 block", error ? "text-destructive" : "text-foreground")}>
          {label}
        </label>
      )}

      <button
        ref={ref}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm",
          error && "border-destructive",
          !hasValue && "text-muted-foreground"
        )}
        {...props}
      >
        <span className="truncate">{hasValue ? (multiple ? `${value.length} items selected` : options.find(opt => opt.value === value)?.label) : placeholder}</span>
        <div className="flex items-center gap-1">
          {clearable && hasValue && !disabled && (
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={handleClear}>
              <X className="h-3 w-3" />
            </Button>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-white border border-border rounded-md shadow-md"
          >
            {searchable && (
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-8"
                  />
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No options found</div>
              ) : (
                filteredOptions.map(option => (
                  <div
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      isSelected(option.value) && "bg-primary text-primary-foreground",
                      option.disabled && "pointer-events-none opacity-50"
                    )}
                    onClick={() => !option.disabled && handleOptionSelect(option)}
                  >
                    <span className="flex-1">{option.label}</span>
                    {multiple && isSelected(option.value) && <Check className="h-4 w-4" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {description && !error && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
});

Select.displayName = "Select";
export default Select;
