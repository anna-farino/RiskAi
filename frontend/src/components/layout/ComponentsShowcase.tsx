import React from 'react';
import { Logo } from '@/components/ui/logo';
import { RisqButton } from '@/components/ui/risq-button';
import { RisqBadge, RisqGradientBadge } from '@/components/ui/risq-badge';
import { 
  RisqCard, 
  RisqCardHeader, 
  RisqCardTitle, 
  RisqCardDescription, 
  RisqCardContent,
  RisqCardFooter 
} from '@/components/ui/risq-card';
import { RisqContainer, RisqSection } from '@/components/ui/risq-container';
import { RisqLayout } from '@/components/layout/RisqLayout';
import { ChevronRight, Bell, Check, Star, Trash, Edit } from 'lucide-react';

export function ComponentsShowcase() {
  return (
    <RisqLayout>
      <div className="bg-background p-4">
        <div className="mb-8 text-center pt-8">
          <h1 className="text-3xl font-bold mb-2">RisqAi UI Components</h1>
          <p className="text-muted-foreground">A showcase of RisqAi-themed UI components for the News Radar application</p>
          <div className="flex justify-center mt-4">
            <Logo size="lg" />
          </div>
        </div>

        {/* Logos Section */}
        <RisqSection paddingY="lg" background="gradient" className="mb-8 rounded-xl">
          <h2 className="text-2xl font-semibold mb-4 text-center">Logo Variations</h2>
          <div className="flex flex-wrap justify-center gap-8 mb-6">
            <div className="flex flex-col items-center">
              <p className="mb-2 text-sm font-medium">Small</p>
              <Logo size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <p className="mb-2 text-sm font-medium">Medium</p>
              <Logo size="md" />
            </div>
            <div className="flex flex-col items-center">
              <p className="mb-2 text-sm font-medium">Large</p>
              <Logo size="lg" />
            </div>
            <div className="flex flex-col items-center">
              <p className="mb-2 text-sm font-medium">Interactive</p>
              <Logo interactive size="md" />
            </div>
          </div>
        </RisqSection>

        {/* Buttons Section */}
        <RisqSection paddingY="lg" className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Buttons</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <RisqCard variant="glass" className="h-full">
              <RisqCardHeader>
                <RisqCardTitle>Button Variants</RisqCardTitle>
              </RisqCardHeader>
              <RisqCardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-4">
                    <RisqButton variant="primary">Primary</RisqButton>
                    <RisqButton variant="secondary">Secondary</RisqButton>
                    <RisqButton variant="outline">Outline</RisqButton>
                    <RisqButton variant="ghost">Ghost</RisqButton>
                    <RisqButton variant="link">Link</RisqButton>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <RisqButton isLoading variant="primary">Loading</RisqButton>
                    <RisqButton disabled variant="primary">Disabled</RisqButton>
                  </div>
                </div>
              </RisqCardContent>
            </RisqCard>
            
            <RisqCard variant="glass" className="h-full">
              <RisqCardHeader>
                <RisqCardTitle>Button Sizes & Icons</RisqCardTitle>
              </RisqCardHeader>
              <RisqCardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <RisqButton size="sm">Small</RisqButton>
                    <RisqButton size="md">Medium</RisqButton>
                    <RisqButton size="lg">Large</RisqButton>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <RisqButton icon={<Bell />}>With Icon</RisqButton>
                    <RisqButton icon={<ChevronRight />} iconPosition="right">
                      Icon Right
                    </RisqButton>
                    <RisqButton icon={<Check />} variant="secondary">
                      Secondary Icon
                    </RisqButton>
                  </div>
                </div>
              </RisqCardContent>
            </RisqCard>
          </div>
        </RisqSection>

        {/* Cards Section */}
        <RisqSection paddingY="lg" background="muted" className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cards</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <RisqCard variant="default">
              <RisqCardHeader>
                <RisqCardTitle>Default Card</RisqCardTitle>
                <RisqCardDescription>
                  A simple card with default styling
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>This card uses the default variant with standard border and background.</p>
              </RisqCardContent>
            </RisqCard>
            
            <RisqCard variant="glass">
              <RisqCardHeader>
                <RisqCardTitle>Glass Card</RisqCardTitle>
                <RisqCardDescription>
                  Elegant glass morphism effect
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>The glass card has a subtle transparency and blur effect.</p>
              </RisqCardContent>
            </RisqCard>
            
            <RisqCard variant="bordered">
              <RisqCardHeader>
                <RisqCardTitle>Bordered Card</RisqCardTitle>
                <RisqCardDescription>
                  Card with a distinctive border
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>This card has a prominent border in the primary color.</p>
              </RisqCardContent>
            </RisqCard>
            
            <RisqCard variant="elevated">
              <RisqCardHeader>
                <RisqCardTitle>Elevated Card</RisqCardTitle>
                <RisqCardDescription>
                  Card with drop shadow
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>The elevated card has a shadow for a raised appearance.</p>
              </RisqCardContent>
            </RisqCard>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <RisqCard variant="glass" interactive>
              <RisqCardHeader>
                <RisqCardTitle>Interactive Card</RisqCardTitle>
                <RisqCardDescription>
                  This card has hover animations
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>Interactive cards provide visual feedback on hover and can be clickable.</p>
                <p className="mt-4">Try hovering over this card!</p>
              </RisqCardContent>
              <RisqCardFooter>
                <RisqButton size="sm" variant="outline">Learn More</RisqButton>
              </RisqCardFooter>
            </RisqCard>
            
            <RisqCard variant="glass" padding="lg">
              <RisqCardHeader>
                <RisqCardTitle>Card with Actions</RisqCardTitle>
                <RisqCardDescription>
                  Example of a card with action buttons
                </RisqCardDescription>
              </RisqCardHeader>
              <RisqCardContent>
                <p>Cards can contain various interactive elements and custom content.</p>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center">
                    <Star className="h-5 w-5 text-amber-500 mr-1" />
                    <span className="text-sm font-medium">4.9/5</span>
                  </div>
                  <RisqBadge variant="purple">Featured</RisqBadge>
                </div>
              </RisqCardContent>
              <RisqCardFooter className="justify-between">
                <div className="flex gap-2">
                  <RisqButton size="sm" variant="ghost" icon={<Edit />}>Edit</RisqButton>
                  <RisqButton size="sm" variant="ghost" icon={<Trash />} className="text-red-500">Delete</RisqButton>
                </div>
                <RisqButton size="sm">View Details</RisqButton>
              </RisqCardFooter>
            </RisqCard>
          </div>
        </RisqSection>

        {/* Badges Section */}
        <RisqSection paddingY="lg" className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Badges</h2>
          
          <RisqCard variant="glass" className="mb-8">
            <RisqCardHeader>
              <RisqCardTitle>Badge Variants</RisqCardTitle>
            </RisqCardHeader>
            <RisqCardContent>
              <div className="flex flex-wrap gap-3">
                <RisqBadge variant="default">Default</RisqBadge>
                <RisqBadge variant="purple">Purple</RisqBadge>
                <RisqBadge variant="magenta">Magenta</RisqBadge>
                <RisqBadge variant="cyan">Cyan</RisqBadge>
                <RisqBadge variant="green">Green</RisqBadge>
                <RisqBadge variant="orange">Orange</RisqBadge>
                <RisqBadge variant="outline">Outline</RisqBadge>
              </div>
            </RisqCardContent>
          </RisqCard>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <RisqCard variant="glass">
              <RisqCardHeader>
                <RisqCardTitle>Gradient Badges</RisqCardTitle>
              </RisqCardHeader>
              <RisqCardContent>
                <div className="flex flex-wrap gap-3">
                  <RisqGradientBadge gradient="purple-magenta">Purple-Magenta</RisqGradientBadge>
                  <RisqGradientBadge gradient="cyan-green">Cyan-Green</RisqGradientBadge>
                  <RisqGradientBadge gradient="orange-yellow">Orange-Yellow</RisqGradientBadge>
                </div>
              </RisqCardContent>
            </RisqCard>
            
            <RisqCard variant="glass">
              <RisqCardHeader>
                <RisqCardTitle>Badge Variations</RisqCardTitle>
              </RisqCardHeader>
              <RisqCardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium">Sizes:</span>
                    <RisqBadge variant="purple" size="sm">Small</RisqBadge>
                    <RisqBadge variant="purple" size="md">Medium</RisqBadge>
                    <RisqBadge variant="purple" size="lg">Large</RisqBadge>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium">With dot:</span>
                    <RisqBadge variant="green" withDot>Active</RisqBadge>
                    <RisqBadge variant="orange" withDot dotColor="#f97316">Warning</RisqBadge>
                    <RisqBadge variant="purple" withDot>New</RisqBadge>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-sm font-medium">Interactive:</span>
                    <RisqBadge variant="purple" interactive>Click me</RisqBadge>
                    <RisqGradientBadge interactive>Gradient</RisqGradientBadge>
                  </div>
                </div>
              </RisqCardContent>
            </RisqCard>
          </div>
        </RisqSection>

        {/* Containers Section */}
        <RisqSection paddingY="lg" background="gradient" className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Containers</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Container Variants</h3>
              
              <RisqContainer variant="default" width="full" className="py-4 px-6 border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-center">Default Container</p>
              </RisqContainer>
              
              <RisqContainer variant="glass" width="full" className="py-4">
                <p className="text-center">Glass Container</p>
              </RisqContainer>
              
              <RisqContainer variant="bordered" width="full" className="py-4">
                <p className="text-center">Bordered Container</p>
              </RisqContainer>
              
              <RisqContainer variant="shadowed" width="full" className="py-4">
                <p className="text-center">Shadowed Container</p>
              </RisqContainer>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Container Sizes</h3>
              
              <RisqContainer width="xs" variant="glass" className="py-2">
                <p className="text-center">XS Container</p>
              </RisqContainer>
              
              <RisqContainer width="sm" variant="glass" className="py-2">
                <p className="text-center">SM Container</p>
              </RisqContainer>
              
              <RisqContainer width="md" variant="glass" className="py-2">
                <p className="text-center">MD Container</p>
              </RisqContainer>
              
              <RisqContainer width="lg" variant="glass" className="py-2">
                <p className="text-center">LG Container</p>
              </RisqContainer>
            </div>
          </div>
        </RisqSection>
        
        <p className="text-center py-6 text-muted-foreground">
          RisqAi UI Components - For News Radar Application
        </p>
      </div>
    </RisqLayout>
  );
}