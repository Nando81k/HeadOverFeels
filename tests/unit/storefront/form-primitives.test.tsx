import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/storefront/ui/Input'
import { Select } from '@/components/storefront/ui/Select'
import { Checkbox } from '@/components/storefront/ui/Checkbox'
import { QuantityStepper } from '@/components/storefront/ui/QuantityStepper'
import { Skeleton, SkeletonText } from '@/components/storefront/ui/Skeleton'

afterEach(cleanup)

describe('Input', () => {
  it('links the label to the input with a generated id', () => {
    render(<Input label="Email" />)
    const input = screen.getByLabelText('Email')
    const label = screen.getByText('Email')
    expect(input.tagName).toBe('INPUT')
    expect(input.id).toBeTruthy()
    expect(label).toHaveAttribute('for', input.id)
  })

  it('honours an explicit id', () => {
    render(<Input label="Email" id="newsletter-email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'newsletter-email')
  })

  it('renders no error node and is not aria-invalid by default', () => {
    render(<Input label="Email" />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('renders the error in role="alert" and sets aria-invalid', () => {
    render(<Input label="Email" error="Enter a valid email" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a valid email')
    expect(alert.className).toContain('text-danger')

    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain(alert.id)
    expect(input.className).toContain('border-danger')
  })

  it('describes the input with its hint', () => {
    render(<Input label="Postcode" hint="UK format" />)
    const hint = screen.getByText('UK format')
    expect(screen.getByLabelText('Postcode').getAttribute('aria-describedby')).toContain(hint.id)
  })

  it('describes the input with both hint and error when both are present', () => {
    render(<Input label="Postcode" hint="UK format" error="Required" />)
    const describedBy = screen.getByLabelText('Postcode').getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(2)
  })

  it('hideLabel keeps the label in the accessibility tree but visually hidden', () => {
    render(<Input label="Search" hideLabel />)
    expect(screen.getByText('Search').className).toContain('sr-only')
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('carries the token box and focus-ring classes', () => {
    render(<Input label="Email" />)
    const cls = screen.getByLabelText('Email').className
    expect(cls).toContain('h-12')
    expect(cls).toContain('rounded-sharp')
    expect(cls).toContain('border-line-strong')
    expect(cls).toContain('bg-paper')
    expect(cls).toContain('focus-visible:outline-signal')
  })

  it('forwards native input attributes and accepts typing', async () => {
    const onChange = vi.fn<() => void>()
    render(<Input label="Email" type="email" placeholder="you@example.com" onChange={onChange} />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'you@example.com')
    await userEvent.type(input, 'hi')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('merges a custom className onto the input', () => {
    render(<Input label="Email" className="w-64" />)
    expect(screen.getByLabelText('Email').className).toContain('w-64')
  })
})

describe('Select', () => {
  const options = [
    { value: 's', label: 'Small' },
    { value: 'm', label: 'Medium' },
    { value: 'l', label: 'Large', disabled: true },
  ]

  it('renders a native <select> with the given options', () => {
    render(<Select label="Size" options={options} defaultValue="m" />)
    const select = screen.getByLabelText('Size')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: 'Large' })).toBeDisabled()
    expect((select as HTMLSelectElement).value).toBe('m')
  })

  it('renders <option> children when no options prop is given', () => {
    render(
      <Select label="Country">
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
      </Select>
    )
    expect(screen.getAllByRole('option')).toHaveLength(2)
  })

  it('renders a decorative chevron and hides the native arrow', () => {
    const { container } = render(<Select label="Size" options={options} />)
    expect(screen.getByLabelText('Size').className).toContain('appearance-none')
    expect(screen.getByLabelText('Size').className).toContain('pr-10')
    const icon = container.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('links its label and reports errors like Input', () => {
    render(<Select label="Size" options={options} error="Pick a size" />)
    const select = screen.getByLabelText('Size')
    expect(screen.getByText('Size')).toHaveAttribute('for', select.id)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Pick a size')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select.getAttribute('aria-describedby')).toContain(alert.id)
  })

  it('fires onChange when a different option is picked', async () => {
    const onChange = vi.fn<() => void>()
    render(<Select label="Size" options={options} defaultValue="s" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Size'), 'm')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('Checkbox', () => {
  it('takes its accessible name from the label text', () => {
    render(<Checkbox label="Email me about drops" />)
    const box = screen.getByRole('checkbox', { name: 'Email me about drops' })
    expect(box).toHaveAttribute('type', 'checkbox')
  })

  it('toggles on click and reports state', async () => {
    const onChange = vi.fn<() => void>()
    render(<Checkbox label="Remember me" onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Remember me' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(box).toBeChecked()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('toggles when the visible label text is clicked', async () => {
    render(<Checkbox label="Gift wrap" />)
    await userEvent.click(screen.getByText('Gift wrap'))
    expect(screen.getByRole('checkbox', { name: 'Gift wrap' })).toBeChecked()
  })

  it('restyles the native input with a peer-driven box', () => {
    const { container } = render(<Checkbox label="Terms" />)
    const box = screen.getByRole('checkbox', { name: 'Terms' })
    expect(box.className).toContain('peer')
    expect(box.className).toContain('sr-only')
    const visual = container.querySelector('[data-checkbox-box]')
    expect(visual).not.toBeNull()
    expect(visual).toHaveAttribute('aria-hidden', 'true')
    expect(visual?.className).toContain('peer-checked:bg-ink')
    expect(visual?.className).toContain('rounded-sharp')
    expect(visual?.className).toContain('border-line-strong')
  })

  it('supports a controlled checked prop', () => {
    render(<Checkbox label="Subscribe" checked readOnly />)
    expect(screen.getByRole('checkbox', { name: 'Subscribe' })).toBeChecked()
  })

  it('renders the error in role="alert" and sets aria-invalid', () => {
    render(<Checkbox label="Accept the terms" error="You must accept the terms" />)
    const box = screen.getByRole('checkbox', { name: 'Accept the terms' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('You must accept the terms')
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box.getAttribute('aria-describedby')).toContain(alert.id)
  })
})

/** Controlled harness: the stepper is a controlled component. */
function StepperHarness({
  initial = 1,
  onChange,
  ...rest
}: {
  initial?: number
  onChange: (next: number) => void
  min?: number
  max?: number
  label?: string
  size?: 'sm' | 'md'
}) {
  const [value, setValue] = React.useState(initial)
  return (
    <QuantityStepper
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
      {...rest}
    />
  )
}

describe('QuantityStepper', () => {
  it('renders a labelled group with both buttons and a numeric input', () => {
    render(<QuantityStepper value={2} onChange={vi.fn<() => void>()} />)
    const group = screen.getByRole('group', { name: 'Quantity' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument()

    const input = screen.getByLabelText('Quantity', { selector: 'input' })
    expect(input).toHaveAttribute('inputMode', 'numeric')
    expect(input).toHaveAttribute('pattern', '[0-9]*')
    expect(input.className).toContain('num')
    expect((input as HTMLInputElement).value).toBe('2')
  })

  it('uses a custom group label', () => {
    render(<QuantityStepper value={1} label="Bag quantity" onChange={vi.fn<() => void>()} />)
    expect(screen.getByRole('group', { name: 'Bag quantity' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bag quantity', { selector: 'input' })).toBeInTheDocument()
  })

  it('disables decrement at the minimum', () => {
    render(<QuantityStepper value={1} onChange={vi.fn<() => void>()} />)
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled()
  })

  it('disables increment at the maximum', () => {
    render(<QuantityStepper value={5} max={5} onChange={vi.fn<() => void>()} />)
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeEnabled()
  })

  it('increments and decrements by one', async () => {
    const onChange = vi.fn<(next: number) => void>()
    render(<QuantityStepper value={3} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(onChange).toHaveBeenCalledWith(4)
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('commits a typed value on blur', async () => {
    const onChange = vi.fn<(next: number) => void>()
    render(<StepperHarness onChange={onChange} max={10} />)
    const input = screen.getByLabelText('Quantity', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.type(input, '7')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(7)
    expect((input as HTMLInputElement).value).toBe('7')
  })

  it('clamps a typed value above max', async () => {
    const onChange = vi.fn<(next: number) => void>()
    render(<StepperHarness onChange={onChange} max={5} />)
    const input = screen.getByLabelText('Quantity', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.type(input, '99')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(5)
    expect((input as HTMLInputElement).value).toBe('5')
  })

  it('falls back to min when the field is emptied', async () => {
    const onChange = vi.fn<(next: number) => void>()
    render(<StepperHarness initial={4} min={2} onChange={onChange} />)
    const input = screen.getByLabelText('Quantity', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(2)
    expect((input as HTMLInputElement).value).toBe('2')
  })

  it('clamps a typed value below min', async () => {
    const onChange = vi.fn<(next: number) => void>()
    render(<StepperHarness initial={4} min={3} onChange={onChange} />)
    const input = screen.getByLabelText('Quantity', { selector: 'input' })
    await userEvent.clear(input)
    await userEvent.type(input, '1')
    await userEvent.tab()
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('supports the sm size', () => {
    render(<QuantityStepper value={1} size="sm" onChange={vi.fn<() => void>()} />)
    expect(screen.getByLabelText('Quantity', { selector: 'input' }).className).toContain('h-9')
  })
})

describe('Skeleton', () => {
  it('is hidden from assistive tech and pulses only when motion is allowed', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el.className).toContain('motion-safe:animate-pulse')
    expect(el.className).not.toContain(' animate-pulse')
    expect(el.className).toContain('bg-line')
    expect(el.className).toContain('rounded-sharp')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-24')
  })

  it('SkeletonText renders one bar per line', () => {
    const { container } = render(<SkeletonText lines={3} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    expect(wrapper.querySelectorAll('[data-skeleton]')).toHaveLength(3)
  })

  it('SkeletonText defaults to 3 lines', () => {
    const { container } = render(<SkeletonText />)
    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(3)
  })
})
