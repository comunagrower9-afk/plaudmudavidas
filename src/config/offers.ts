export type OfferVariant = 'standard' | 'discount'

export type ColorId = 'blue' | 'gray' | 'silver' | 'starlight'

export interface OfferConfig {
  variant: OfferVariant
  priceCents: number
  price: number
  checkoutUrlsByColor: Record<ColorId, string>
  noindex: boolean
}

export const OFFERS: Record<OfferVariant, OfferConfig> = {
  standard: {
    variant: 'standard',
    priceCents: 11990,
    price: 119.90,
    checkoutUrlsByColor: {
      blue: 'https://checkout.plaudai.site/VCCL1O8SD7C1',
      gray: 'https://checkout.plaudai.site/VCCL1O8SD7C0',
      silver: 'https://checkout.plaudai.site/VCCL1O8SD7BX',
      starlight: 'https://checkout.plaudai.site/VCCL1O8SD7BU',
    },
    noindex: false,
  },
  discount: {
    variant: 'discount',
    priceCents: 8690,
    price: 86.90,
    checkoutUrlsByColor: {
      blue: 'https://checkout.plaudai.site/VCCL1O8SD7GD',
      gray: 'https://checkout.plaudai.site/VCCL1O8SD7GE',
      silver: 'https://checkout.plaudai.site/VCCL1O8SD7GF',
      starlight: 'https://checkout.plaudai.site/VCCL1O8SD7GG',
    },
    noindex: true,
  },
}
