// @flow

import React, { Component, type Node } from 'react';
import { Modal, Text, TouchableWithoutFeedback, View } from 'react-native';

import { bottomSheetStyles as styles } from './styles';

/**
 * The type of {@code BottomSheet}'s React {@code Component} prop types.
 */
type Props = {

    /**
     * The children to be displayed within this component.
     */
    children: Node,

    /**
     * Handler for the cancel event, which happens when the user dismisses
     * the sheet.
     */
    onCancel: ?Function,

    /**
     * (Optional) title for the sheet.
     */
    title: ?string
};

/**
 * A component emulating Android's BottomSheet. For all intents and purposes,
 * this component has been designed to work and behave as a {@code Dialog}.
 */
export default class BottomSheet extends Component<Props> {
    /**
     * Initializes a new {@code BottomSheet} instance.
     *
     * @inheritdoc
     */
    constructor(props: Props) {
        super(props);

        this._onCancel = this._onCancel.bind(this);
    }

    /**
     * Renders the sheet title, if available.
     *
     * @private
     * @returns {ReactElement}
     */
    _renderTitle() {
        const { title } = this.props;

        if (!title || !title.length) {
            return undefined;
        }

        return (
            <View style = { styles.titleRow }>
                <Text style = { styles.titleText }>
                    { title }
                </Text>
            </View>
        );
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        return [
            <View
                key = 'overlay'
                style = { styles.overlay } />,
            <Modal
                animationType = { 'slide' }
                key = 'modal'
                onRequestClose = { this._onCancel }
                supportedOrientations = { [
                    'landscape',
                    'portrait'
                ] }
                transparent = { true }
                visible = { true }>
                <View style = { styles.container }>
                    <TouchableWithoutFeedback
                        onPress = { this._onCancel } >
                        <View style = { styles.backdrop } />
                    </TouchableWithoutFeedback>
                    <View style = { styles.sheet }>
                        { this._renderTitle() }
                        { this.props.children }
                    </View>
                </View>
            </Modal>
        ];
    }

    _onCancel: () => void;

    /**
     * Cancels the dialog by calling the onCancel prop callback.
     *
     * @private
     * @returns {void}
     */
    _onCancel() {
        const { onCancel } = this.props;

        onCancel && onCancel();
    }
}
