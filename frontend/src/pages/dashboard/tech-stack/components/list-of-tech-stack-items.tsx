import { UseMutationResult } from "@tanstack/react-query"
import { type TechStackResponse } from "./tech-stack"
import { TechStackItem } from "./tech-item-wrapper";

type Type = 'software' | 'hardware' | 'client' | 'vendor'
type Category = 'software' | 'hardware' | 'clients' | 'vendors' 

type Props = {
  techStack: TechStackResponse | undefined
  category: Category 
  optimisticItemName: string
  optimisticItemType: Type | null
  toggleItem: UseMutationResult<any, Error, 
    {
      itemId: string; 
      type: string; 
      isActive: boolean;
    }, {
      previousData: TechStackResponse | undefined;
    }>
  removeItem: UseMutationResult<any, Error, 
    {
      itemId: string; 
      type: string; 
    }, {
      previousData: TechStackResponse | undefined;
    }>
}

export default function ListOfTechStackItems({ 
  techStack, 
  category, 
  optimisticItemName,
  optimisticItemType,
  toggleItem,
  removeItem
}
: Props
) {
  const optimistic = optimisticItemName.length > 0
  const type = category.slice(-1) === 's' ? category.slice(0,-1) as Type : category as Type

  if (techStack && (!optimistic || optimisticItemType !== type) ) {
    return techStack[category]
      .sort((a,b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map(item => (
        <TechStackItem
          toggleItem={toggleItem}
          removeItem={removeItem}
          key={item.id}
          item={item}
          type={type}
        />
      ))
  }

  if (techStack && optimistic) { 
    return [
        { id: "optimistic", name: optimisticItemName, createdAt: new Date() },
        ...techStack[category], 
      ]
      .sort((a,b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map(item => (
        <TechStackItem
          toggleItem={toggleItem}
          removeItem={removeItem}
          key={item.id}
          item={item}
          type={type}
        />
      ))
  }

  if (!techStack || !techStack[category] || techStack[category].length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
      {`No ${category} added yet. Add your ${category} stack to monitor threats.`}
      </div>
    )
  }
}
