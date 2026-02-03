import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RichText = ({ content, className, as: Tag = 'p', style }: { content: string, className?: string, as?: any, style?: React.CSSProperties }) => {
    if (!content) return null;
    const processed = content
        .replace(/<b>/g, '<strong class="font-black">')
        .replace(/<\/b>/g, '</strong>')
        .replace(/<br\s*\/?>/g, '<br />');

    return (
        <Tag
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: processed }}
        />
    );
};

function getContrastColor(hexColor: string) {
    if (!hexColor) return '#ffffff';
    const color = hexColor.replace('#', '');
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);

    // Improved luminance calculation
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return (luminance > 0.6) ? '#000000' : '#ffffff';
}

interface BlockRendererProps {
    section: any;
    heroColor?: string;
    agencyLogo?: string;
    agencyName?: string;
    isPreview?: boolean;
    onElementSelect?: (blockId: string, elementPath: string, content: string) => void;
    selectedElement?: { blockId: string, elementPath: string } | null;
    theme?: ProposalTheme;
}

export interface ProposalTheme {
    fontScale: number; // 0.8 to 1.2
    spacingScale: number; // 0.8 to 1.5
    borderRadius: 'none' | 'md' | 'full';
    primaryColor?: string;
    horizontalSpacing: number; // 0 to 4 (rem additions)
}

function getBorderRadiusClass(radius: ProposalTheme['borderRadius']) {
    switch (radius) {
        case 'none': return 'rounded-none';
        case 'md': return 'rounded-[1rem]';
        case 'full': return 'rounded-[2.5rem]';
        default: return 'rounded-[2.5rem]';
    }
}

const EditableElement = ({
    children,
    blockId,
    elementPath,
    content,
    isActive,
    onClick,
    isPreview
}: {
    children: React.ReactNode,
    blockId: string,
    elementPath: string,
    content: string,
    isActive: boolean,
    onClick?: () => void,
    isPreview: boolean
}) => {
    if (isPreview) return <>{children}</>;

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={cn(
                "relative cursor-pointer transition-all duration-300 rounded-lg group/element",
                isActive
                    ? "ring-2 ring-primary ring-offset-4 bg-primary/5 shadow-lg scale-[1.01]"
                    : "hover:bg-neutral-500/5 hover:scale-[1.005]"
            )}
        >
            {children}
            <div className={cn(
                "absolute -top-2 -right-2 opacity-0 group-hover/element:opacity-100 transition-opacity z-10",
                isActive && "opacity-100"
            )}>
                <div className="bg-primary text-white text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest shadow-lg flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Editar Elemento
                </div>
            </div>
        </div>
    );
};

export function BlockRenderer({ section, heroColor = '#000000', agencyLogo, agencyName, isPreview = false, onElementSelect, selectedElement, theme, onBlockSelect, selectedBlockId }: BlockRendererProps & { onBlockSelect?: (id: string, type: string) => void, selectedBlockId?: string | null }) {
    const { type, settings, id } = section;

    const Wrapper = ({ children, blockId, sectionType }: { children: React.ReactNode, blockId?: string, sectionType: string }) => {
        if (isPreview) return <>{children}</>;

        const isSelected = selectedBlockId === blockId;

        return (
            <div className={cn(
                "relative group/block transition-all duration-300",
                isSelected && "ring-2 ring-primary ring-offset-4 rounded-[2.5rem] z-10"
            )}>
                {blockId && (
                    <div className={cn(
                        "absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-50",
                        isSelected && "opacity-100"
                    )}>
                        <div className="bg-neutral-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl border border-white/10 flex items-center gap-2">
                            <span className="opacity-50">#{sectionType}</span>
                            <div className="w-[1px] h-3 bg-white/20" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBlockSelect?.(blockId, sectionType);
                                }}
                                className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <Sparkles className="h-3 w-3" />
                                <span>{isSelected ? 'Editando...' : 'Editar Sección'}</span>
                            </button>
                        </div>
                    </div>
                )}
                {children}
            </div>
        );
    };

    const renderBlock = () => {
        const commonProps = {
            settings,
            id,
            heroColor: theme?.primaryColor || heroColor,
            agencyLogo,
            agencyName,
            isPreview,
            onElementSelect,
            selectedElement,
            theme: theme || { fontScale: 1, spacingScale: 1, borderRadius: 'full', horizontalSpacing: 0 }
        };
        switch (type) {
            case 'hero':
                return <HeroBlock {...commonProps} />;
            case 'solution':
                return <SolutionBlock {...commonProps} />;
            case 'features':
                return <FeaturesBlock {...commonProps} />;
            case 'columns':
                return <ColumnsBlock {...commonProps} />;
            case 'image_full':
                return <ImageFullBlock {...commonProps} />;
            case 'footer':
                return <FooterBlock {...commonProps} />;
            case 'cta':
                return <CTABlock {...commonProps} />;
            case 'page_break':
                return <PageBreakBlock isPreview={isPreview} id={id} />;
            default:
                return null;
        }
    };

    return <Wrapper blockId={id} sectionType={type}>{renderBlock()}</Wrapper>;
}

import { cn } from '@/lib/utils'; // Assuming cn exists

function HeroBlock({ settings, heroColor, agencyLogo, agencyName, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const heroTextColor = getContrastColor(heroColor);
    const logoPosition = settings.logo_position || 'center';
    const textAlign = settings.text_align || 'center';

    const logoAlignClass = {
        'left': 'self-start',
        'center': 'self-center',
        'right': 'self-end'
    }[logoPosition as 'left' | 'center' | 'right'] || 'self-center';

    const contentAlignClass = {
        'left': 'text-left items-start',
        'center': 'text-center items-center',
        'right': 'text-right items-end'
    }[textAlign as 'left' | 'center' | 'right'] || 'text-center items-center';

    return (
        <div
            className={cn(
                "transition-colors duration-700 flex flex-col min-h-[70vh] justify-center",
                contentAlignClass
            )}
            style={{
                backgroundColor: heroColor,
                paddingLeft: `${Math.max(2, 2 + (theme?.horizontalSpacing || 0))}rem`,
                paddingRight: `${Math.max(2, 2 + (theme?.horizontalSpacing || 0))}rem`,
                paddingTop: `${Math.max(2, 2 + (theme?.spacingScale || 0))}rem`,
                paddingBottom: `${Math.max(2, 2 + (theme?.spacingScale || 0))}rem`,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background Logic */}
            {settings.image_prompt && (
                <>
                    <img
                        src={`https://images.unsplash.com/photo-1523240715632-d984bc4b7969?auto=format&fit=crop&q=80&w=1920&keywords=${encodeURIComponent(settings.image_prompt.split(',')[0])}`}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    {/* Overlay to ensure the brand color is present but allows image to show through */}
                    <div
                        className="absolute inset-0 transition-opacity duration-500 bg-black/20"
                    />
                    <div
                        className="absolute inset-0 transition-all duration-500 mix-blend-multiply opacity-80"
                        style={{ backgroundColor: heroColor }}
                    />
                </>
            )}
            <div className="relative z-10 flex flex-col gap-10 w-full max-w-5xl">
                {agencyLogo && (
                    <div className={logoAlignClass}>
                        <img
                            src={agencyLogo}
                            alt={agencyName}
                            className="h-16 lg:h-20 object-contain filter drop-shadow-2xl"
                        />
                    </div>
                )}

                <div className={cn("flex flex-col gap-6", contentAlignClass)}>
                    <div
                        className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border backdrop-blur-xl w-fit"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            color: heroTextColor,
                            borderColor: 'rgba(255,255,255,0.2)'
                        }}
                    >
                        Propuesta por {agencyName}
                    </div>

                    <EditableElement
                        blockId={id}
                        elementPath="headline"
                        content={settings.headline}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'headline'}
                        onClick={() => onElementSelect?.(id, 'headline', settings.headline)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="h1"
                            content={settings.headline}
                            className={cn(
                                "font-black leading-[0.9] tracking-tighter",
                                !settings.headline_size && "text-4xl lg:text-5xl"
                            )}
                            style={{
                                color: heroTextColor,
                                textShadow: heroTextColor === '#ffffff' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
                                fontSize: settings.headline_size ? `clamp(1.8rem, ${parseFloat(settings.headline_size) * 0.04 * theme.fontScale}vw, ${parseFloat(settings.headline_size) * 0.05 * theme.fontScale}rem)` : undefined
                            }}
                        />
                    </EditableElement>

                    {settings.intro && (
                        <EditableElement
                            blockId={id}
                            elementPath="intro"
                            content={settings.intro}
                            isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'intro'}
                            onClick={() => onElementSelect?.(id, 'intro', settings.intro)}
                            isPreview={isPreview}
                        >
                            <RichText
                                as="p"
                                content={settings.intro}
                                className={cn(
                                    "font-medium leading-tight max-w-4xl",
                                    !settings.intro_size && "text-lg lg:text-xl"
                                )}
                                style={{
                                    color: heroTextColor,
                                    textShadow: heroTextColor === '#ffffff' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                                    opacity: 0.95,
                                    fontSize: settings.intro_size ? `clamp(1rem, ${parseFloat(settings.intro_size) * 0.02 * theme.fontScale}vw, ${parseFloat(settings.intro_size) * 0.025 * theme.fontScale}rem)` : undefined
                                }}
                            />
                        </EditableElement>
                    )}
                </div>
            </div>
        </div>
    );
}


function SolutionBlock({ settings, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const textAlign = settings.text_align || 'left';
    const alignClass = {
        'left': 'text-left items-start',
        'center': 'text-center items-center',
        'right': 'text-right items-end'
    }[textAlign as 'left' | 'center' | 'right'] || 'text-left items-start';

    return (
        <section className={cn(
            "bg-neutral-50/50 px-8 lg:px-24 border border-neutral-100 flex flex-col gap-10",
            getBorderRadiusClass(theme.borderRadius),
            alignClass
        )}
            style={{ paddingTop: `${5 * theme.spacingScale}rem`, paddingBottom: `${8 * theme.spacingScale}rem` }}
        >
            <div className={cn("space-y-4", alignClass)}>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Propuesta de Valor</p>
                <EditableElement
                    blockId={id}
                    elementPath="title"
                    content={settings.title}
                    isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'title'}
                    onClick={() => onElementSelect?.(id, 'title', settings.title)}
                    isPreview={isPreview}
                >
                    <RichText
                        as="h2"
                        content={settings.title || 'Nuestra Visión'}
                        className={cn(
                            "font-black text-neutral-900 leading-[1.1] tracking-tight",
                            !settings.title_size && "text-2xl lg:text-3xl"
                        )}
                        style={{
                            fontSize: settings.title_size ? `clamp(1.5rem, ${parseFloat(settings.title_size) * 0.025}vw, ${parseFloat(settings.title_size) * 0.035}rem)` : undefined
                        }}
                    />
                </EditableElement>
            </div>
            <EditableElement
                blockId={id}
                elementPath="text"
                content={settings.text}
                isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'text'}
                onClick={() => onElementSelect?.(id, 'text', settings.text)}
                isPreview={isPreview}
            >
                <RichText
                    as="p"
                    content={settings.text}
                    className={cn(
                        "text-neutral-800 leading-relaxed font-medium max-w-3xl",
                        !settings.text_size && "text-base lg:text-lg"
                    )}
                    style={{
                        fontSize: settings.text_size ? `clamp(1rem, ${parseFloat(settings.text_size) * 0.015}vw, ${parseFloat(settings.text_size) * 0.02}rem)` : undefined
                    }}
                />
            </EditableElement>
        </section>
    );
}

function FeaturesBlock({ settings, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const textAlign = settings.text_align || 'center';
    const alignClass = {
        'left': 'text-left items-start',
        'center': 'text-center items-center',
        'right': 'text-right items-end'
    }[textAlign as 'left' | 'center' | 'right'] || 'text-center items-center';

    return (
        <section
            className={cn("px-8 lg:px-24 space-y-20", alignClass)}
            style={{ paddingTop: `${5 * theme.spacingScale}rem`, paddingBottom: `${8 * theme.spacingScale}rem` }}
        >
            <div className={cn("space-y-6", alignClass)}>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.4em]">Beneficios Clave</p>
                <EditableElement
                    blockId={id}
                    elementPath="title"
                    content={settings.title}
                    isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'title'}
                    onClick={() => onElementSelect?.(id, 'title', settings.title)}
                    isPreview={isPreview}
                >
                    <RichText
                        as="h2"
                        content={settings.title || '¿Por qué nosotros?'}
                        className={cn(
                            "font-black text-neutral-900 tracking-tighter",
                            !settings.title_size && "text-2xl lg:text-4xl"
                        )}
                        style={{
                            fontSize: settings.title_size ? `clamp(1.8rem, ${parseFloat(settings.title_size) * 0.035}vw, ${parseFloat(settings.title_size) * 0.05}rem)` : undefined
                        }}
                    />
                </EditableElement>
            </div>
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 w-full">
                {settings.items?.map((item: string, i: number) => (
                    <EditableElement
                        key={i}
                        blockId={id}
                        elementPath={`items.${i}`}
                        content={item}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === `items.${i}`}
                        onClick={() => onElementSelect?.(id, `items.${i}`, item)}
                        isPreview={isPreview}
                    >
                        <div className={cn(
                            "flex flex-col gap-8 p-10 lg:p-14 bg-white border border-neutral-100 shadow-sm hover:shadow-2xl hover:border-primary/20 transition-all duration-500 group h-full",
                            getBorderRadiusClass(theme.borderRadius)
                        )}>
                            <div className="w-16 h-16 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <RichText
                                as="p"
                                content={item}
                                className="text-base lg:text-lg font-bold text-neutral-900 leading-[1.2] tracking-tight"
                            />
                        </div>
                    </EditableElement>
                ))}
            </div>
        </section>
    );
}

function ColumnsBlock({ settings, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const layoutMap: Record<string, { left: string; right: string; third?: string }> = {
        '4-8': { left: 'md:col-span-4', right: 'md:col-span-8' },
        '8-4': { left: 'md:col-span-8', right: 'md:col-span-4' },
        '6-6': { left: 'md:col-span-6', right: 'md:col-span-6' },
        '4-4-4': { left: 'md:col-span-4', right: 'md:col-span-4', third: 'md:col-span-4' }
    };

    const layout = layoutMap[settings.layout] || layoutMap['6-6'];

    // Corregir la obtención de palabras clave para Unsplash
    const getKeyword = (text: string) => text ? encodeURIComponent(text.split(' ').slice(0, 3).join(' ')) : 'education';

    return (
        <section
            className="px-8 lg:px-24 grid md:grid-cols-12 gap-12 items-center"
            style={{ paddingTop: `${5 * theme.spacingScale}rem`, paddingBottom: `${5 * theme.spacingScale}rem` }}
        >
            <div className={`${layout.left} space-y-4`}>
                {settings.left_content?.type === 'text' ? (
                    <EditableElement
                        blockId={id}
                        elementPath="left_content.value"
                        content={settings.left_content.value}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'left_content.value'}
                        onClick={() => onElementSelect?.(id, 'left_content.value', settings.left_content.value)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="p"
                            content={settings.left_content.value}
                            className="text-base text-neutral-700 leading-relaxed max-w-2xl"
                        />
                    </EditableElement>
                ) : (
                    <img
                        src={settings.left_content?.value && settings.left_content.value.startsWith('http')
                            ? settings.left_content.value
                            : `https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800&keywords=${getKeyword(settings.left_content?.value)}`}
                        alt="Content"
                        className="w-full aspect-square object-cover rounded-[2.5rem] shadow-xl"
                    />
                )}
            </div>
            <div className={`${layout.right} space-y-4`}>
                {settings.right_content?.type === 'text' ? (
                    <EditableElement
                        blockId={id}
                        elementPath="right_content.value"
                        content={settings.right_content.value}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'right_content.value'}
                        onClick={() => onElementSelect?.(id, 'right_content.value', settings.right_content.value)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="p"
                            content={settings.right_content.value}
                            className="text-base text-neutral-700 leading-relaxed max-w-2xl"
                        />
                    </EditableElement>
                ) : (
                    <img
                        src={settings.right_content?.value && settings.right_content.value.startsWith('http')
                            ? settings.right_content.value
                            : `https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800&keywords=${getKeyword(settings.right_content?.value)}`}
                        alt="Content"
                        className="w-full aspect-square object-cover rounded-[2.5rem] shadow-xl"
                    />
                )}
            </div>
            {layout.third && settings.third_content && (
                <div className={`${layout.third} space-y-4`}>
                    {settings.third_content?.type === 'text' ? (
                        <EditableElement
                            blockId={id}
                            elementPath="third_content.value"
                            content={settings.third_content.value}
                            isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'third_content.value'}
                            onClick={() => onElementSelect?.(id, 'third_content.value', settings.third_content.value)}
                            isPreview={isPreview}
                        >
                            <RichText
                                as="p"
                                content={settings.third_content.value}
                                className="text-base text-neutral-700 leading-relaxed max-w-2xl"
                            />
                        </EditableElement>
                    ) : (
                        <img
                            src={settings.third_content?.value && settings.third_content.value.startsWith('http')
                                ? settings.third_content.value
                                : `https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=800&keywords=${getKeyword(settings.third_content?.value)}`}
                            alt="Content"
                            className="w-full aspect-square object-cover rounded-[2.5rem] shadow-xl"
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function ImageFullBlock({ settings, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const keyword = settings.image_prompt?.split(',')[0] || 'education';
    return (
        <section className={cn(
            "relative aspect-video overflow-hidden shadow-2xl bg-neutral-100 group",
            getBorderRadiusClass(theme.borderRadius)
        )}>
            <img
                src={`https://images.unsplash.com/photo-1523240715632-d984bc4b7969?auto=format&fit=crop&q=80&w=1920&keywords=${encodeURIComponent(keyword)}`}
                alt={settings.caption || 'Image'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200";
                }}
            />
            {settings.caption && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-12 lg:p-16">
                    <EditableElement
                        blockId={id}
                        elementPath="caption"
                        content={settings.caption}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'caption'}
                        onClick={() => onElementSelect?.(id, 'caption', settings.caption)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="p"
                            content={settings.caption}
                            className="text-white text-base lg:text-lg font-medium italic opacity-90 max-w-3xl"
                        />
                    </EditableElement>
                </div>
            )}
        </section>
    );
}

function FooterBlock({ settings, agencyLogo, agencyName, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    return (
        <footer className="px-8 lg:px-24 py-12 lg:py-20 border-t border-neutral-100 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="flex items-center gap-6">
                    {agencyLogo && <img src={agencyLogo} alt={agencyName} className="h-12 w-auto grayscale opacity-50" />}
                    <div className="h-12 w-[1px] bg-neutral-100 hidden md:block" />
                    <EditableElement
                        blockId={id}
                        elementPath="text"
                        content={settings.text}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'text'}
                        onClick={() => onElementSelect?.(id, 'text', settings.text)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="p"
                            content={settings.text}
                            className="text-[10px] font-black text-neutral-400 uppercase tracking-widest"
                        />
                    </EditableElement>
                </div>
            </div>
        </footer>
    );
}

function CTABlock({ settings, heroColor, id, onElementSelect, selectedElement, isPreview, theme }: any) {
    const textColor = getContrastColor(heroColor);
    return (
        <section className="px-8 lg:px-24" style={{ paddingTop: `${3 * theme.spacingScale}rem`, paddingBottom: `${6 * theme.spacingScale}rem` }}>
            <div
                className={cn(
                    "p-12 lg:p-24 text-center space-y-12 transition-all duration-700 hover:scale-[1.01]",
                    getBorderRadiusClass(theme.borderRadius)
                )}
                style={{ backgroundColor: heroColor }}
            >
                <div className="space-y-4 flex flex-col items-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: textColor, opacity: 0.6 }}>¿Listo para empezar?</p>
                    <EditableElement
                        blockId={id}
                        elementPath="headline"
                        content={settings.headline}
                        isActive={selectedElement?.blockId === id && selectedElement?.elementPath === 'headline'}
                        onClick={() => onElementSelect?.(id, 'headline', settings.headline)}
                        isPreview={isPreview}
                    >
                        <RichText
                            as="h2"
                            content={settings.headline}
                            className="text-2xl lg:text-4xl font-black max-w-4xl mx-auto leading-[1.1] tracking-tight"
                            style={{
                                color: textColor,
                                textShadow: textColor === '#ffffff' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                            }}
                        />
                    </EditableElement>
                </div>
                <Button
                    size="lg"
                    className="h-16 px-12 rounded-2xl text-lg font-black bg-white hover:bg-neutral-100 transition-all shadow-2xl hover:shadow-white/20"
                    style={{ color: heroColor }}
                >
                    {settings.button_text || 'Solicitar Información'}
                </Button>
            </div>
        </section>
    );
}

function PageBreakBlock({ isPreview, id }: { isPreview: boolean, id: string }) {
    if (isPreview) {
        return <div className="page-break w-full h-0" data-block-id={id} />;
    }

    return (
        <div className="w-full py-8 flex items-center justify-center group relative no-print">
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-neutral-300 w-full" />
            <div className="relative bg-neutral-100 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-neutral-400 border border-neutral-200 group-hover:border-primary group-hover:text-primary transition-colors cursor-grab active:cursor-grabbing hover:bg-white select-none">
                --- Salto de Página ---
            </div>
        </div>
    );
}
