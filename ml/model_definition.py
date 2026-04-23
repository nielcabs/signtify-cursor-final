"""Shared GRU classifier definition for sequence keypoints."""

from tensorflow.keras import regularizers
from tensorflow.keras.layers import GRU, BatchNormalization, Dense, Dropout, Input
from tensorflow.keras.models import Model


def build_sequence_gru_model(
    num_classes: int,
    seq_len: int = 30,
    feature_dim: int = 126,
) -> Model:
    if num_classes < 2:
        raise ValueError("num_classes must be at least 2")

    input_layer = Input(shape=(seq_len, feature_dim), name="input_3")

    l2_reg = regularizers.l2(1e-4)

    # Keep GRU default tanh/sigmoid gates for better temporal stability.
    x = GRU(160, return_sequences=True, name="gru_6")(input_layer)
    x = BatchNormalization(name="batch_normalization")(x)
    x = Dropout(0.3, name="dropout")(x)

    x = GRU(224, return_sequences=True, name="gru_7")(x)
    x = BatchNormalization(name="batch_normalization_1")(x)
    x = Dropout(0.3, name="dropout_1")(x)

    x = GRU(128, return_sequences=False, name="gru_8")(x)
    x = BatchNormalization(name="batch_normalization_2")(x)
    x = Dropout(0.3, name="dropout_2")(x)

    x = Dense(128, activation="relu", kernel_regularizer=l2_reg, name="dense_6")(x)
    x = Dropout(0.4, name="dropout_3")(x)
    x = Dense(64, activation="relu", kernel_regularizer=l2_reg, name="dense_7")(x)
    x = Dropout(0.4, name="dropout_4")(x)
    output_layer = Dense(num_classes, activation="softmax", name="dense_8")(x)

    return Model(inputs=input_layer, outputs=output_layer)


def build_holistic_gru_model(num_classes: int) -> Model:
    """Backward-compatible alias for older imports."""
    return build_sequence_gru_model(num_classes=num_classes, seq_len=30, feature_dim=1662)
