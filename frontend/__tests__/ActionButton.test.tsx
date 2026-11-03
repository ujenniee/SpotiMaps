import renderer, { act } from 'react-test-renderer';
import ActionButton from '../src/components/ActionButton';

test('calls onPress when the action button is pressed', () => {
  const onPress = jest.fn();
  let component: renderer.ReactTestRenderer;

  act(() => {
    component = renderer.create(<ActionButton label="Continue" onPress={onPress} testID="custom-button" />);
  });

  act(() => {
    component.root.findByProps({ testID: 'custom-button' }).props.onPress();
  });

  expect(onPress).toHaveBeenCalledTimes(1);
});
