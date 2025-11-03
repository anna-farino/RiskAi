import TechStackItemComponent from "./tech-stack-item";
import { TechStackResponse, type TechStackItem } from "./tech-stack";
import { UseMutationResult } from "@tanstack/react-query";

type Props = {
  item: TechStackItem;
  type: 'software' | 'hardware' | 'vendor' | 'client'
  toggleItem: UseMutationResult<any, Error, 
    {
      itemId: string; 
      type: string; 
      isActive: boolean;
    }, {
      previousData: TechStackResponse | undefined;
    }
  >
  removeItem: UseMutationResult<any, Error, 
    {
      itemId: string; 
      type: string; 
    }, {
      previousData: TechStackResponse | undefined;
    }
  >
}
export function TechStackItem({
  item,
  type,
  toggleItem,
  removeItem
}
: Props) 
{

  return (
    <TechStackItemComponent
      item={item}
      type={type}
      onToggle={(itemId, type, isActive) => {
        console.log("toggle item")
        toggleItem.mutate({ itemId, type, isActive });
      }}
      onRemove={(itemId, type) => {
        console.log("remove item")
        removeItem.mutate({ itemId, type });
      }}
    />
  );
};
